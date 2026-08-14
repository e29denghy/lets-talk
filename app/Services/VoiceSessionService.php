<?php

namespace App\Services;

use App\Models\ConversationSession;
use App\Models\ConversationTurn;
use App\Models\Scenario;
use App\Models\Visitor;
use App\Models\VoiceAudioChunk;
use App\Models\VoiceQuota;
use App\Realtime\RealtimeProviderManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * 语音会话编排：开始会话（签发凭据）、录音分片追加写盘、回合落库、结束封存。
 */
class VoiceSessionService
{
    /** PCM 录音临时文件与最终 WAV 的私有磁盘目录。 */
    private const DIR_PREFIX = 'voice';

    public function __construct(private RealtimeProviderManager $providers)
    {
    }

    /**
     * 开始一次会话：建记录 + 签发供应商直连凭据 + 组装 system prompt。
     *
     * @return array{session: ConversationSession, credentials: array, system_prompt: string, voice_config: array}
     */
    public function start(Visitor $visitor, Scenario $scenario, string $language = 'en'): array
    {
        $session = ConversationSession::create([
            'visitor_id' => $visitor->id,
            'scenario_id' => $scenario->id,
            'provider' => config('voice.provider'),
            'language' => in_array($language, ['en', 'zh'], true) ? $language : 'en',
            'status' => ConversationSession::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        $visitor->update(['sessions_count' => DB::raw('sessions_count + 1'), 'last_seen_at' => now()]);

        $provider = $this->providers->driver();

        try {
            $credentials = $provider->issueSessionToken($session);
        } catch (\Throwable $e) {
            // 签发失败：清理孤儿会话记录再抛出
            $session->delete();
            throw $e;
        }

        return [
            'session' => $session,
            'credentials' => $credentials->toArray(),
            'system_prompt' => $provider->buildSystemPrompt($scenario, $visitor, $session->language),
            'voice_config' => $scenario->voice_config ?? [],
        ];
    }

    /**
     * 录音分片追加写（幂等：同 channel + seq 只写一次）。
     * 客户端以 application/octet-stream 原始字节上传。
     */
    public function appendAudioChunk(ConversationSession $session, string $channel, int $seq, string $bytes): array
    {
        $this->assertChannel($channel);

        $existing = VoiceAudioChunk::where('session_id', $session->id)
            ->where('channel', $channel)
            ->where('seq', $seq)
            ->first();

        if ($existing) {
            return ['stored' => false, 'duplicate' => true, 'size' => $existing->size];
        }

        $size = strlen($bytes);

        if ($size === 0) {
            throw new RuntimeException('音频分片为空。');
        }

        $path = $this->pcmPath($session, $channel);

        Storage::disk('local')->append($path, $bytes);

        VoiceAudioChunk::create([
            'session_id' => $session->id,
            'channel' => $channel,
            'seq' => $seq,
            'size' => $size,
        ]);

        return ['stored' => true, 'duplicate' => false, 'size' => $size];
    }

    /**
     * 批量落库字幕/回合（按 seq 幂等 upsert）。
     *
     * @param  array<int, array{seq:int, speaker:string, text:string, start_ms?:int, end_ms?:int, latency_ms?:int}>  $turns
     */
    public function storeTurns(ConversationSession $session, array $turns): int
    {
        $rows = [];

        foreach ($turns as $turn) {
            $rows[] = [
                'session_id' => $session->id,
                'seq' => (int) $turn['seq'],
                'speaker' => $turn['speaker'],
                'text' => (string) $turn['text'],
                'start_ms' => $turn['start_ms'] ?? null,
                'end_ms' => $turn['end_ms'] ?? null,
                'latency_ms' => $turn['latency_ms'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ($rows === []) {
            return 0;
        }

        ConversationTurn::upsert($rows, ['session_id', 'seq'], ['speaker', 'text', 'start_ms', 'end_ms', 'latency_ms', 'updated_at']);

        $session->update(['turn_count' => ConversationTurn::where('session_id', $session->id)->count()]);

        return count($rows);
    }

    /**
     * 结束会话：PCM→WAV 封存、写 timeline、统计时长、累计配额。
     *
     * @param  array<int, array<string, mixed>>  $timeline
     */
    public function end(ConversationSession $session, array $timeline = []): ConversationSession
    {
        if ($session->status !== ConversationSession::STATUS_ACTIVE) {
            return $session;
        }

        $durationS = (int) min(
            max($session->started_at?->diffInSeconds(now()) ?? 0, 0),
            (int) config('voice.quota.max_session_seconds', 1800),
        );

        $studentPath = $this->finalizeWav($session, 'student');
        $aiPath = $this->finalizeWav($session, 'ai');

        $timelinePath = null;

        if ($timeline !== []) {
            $timelinePath = $this->dirPath($session).'/timeline.json';
            Storage::disk('local')->put($timelinePath, json_encode($timeline, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        $session->update([
            'status' => ConversationSession::STATUS_ENDED,
            'ended_at' => now(),
            'duration_s' => $durationS,
            'student_audio_path' => $studentPath,
            'ai_audio_path' => $aiPath,
            'timeline_path' => $timelinePath,
        ]);

        $this->addQuota($session->visitor_id, $durationS);

        return $session->fresh();
    }

    /** 读取某通道已上传的 PCM 总字节数（供前端/后台显示上传进度）。 */
    public function uploadedBytes(ConversationSession $session, string $channel): int
    {
        $this->assertChannel($channel);

        return (int) VoiceAudioChunk::where('session_id', $session->id)->where('channel', $channel)->sum('size');
    }

    private function finalizeWav(ConversationSession $session, string $channel): ?string
    {
        $pcmPath = $this->pcmPath($session, $channel);

        if (! Storage::disk('local')->exists($pcmPath)) {
            return null;
        }

        // 学生声道 16kHz、AI 声道 24kHz（供应商输出固定 24k）
        $sampleRate = $channel === 'student'
            ? (int) config('voice.audio.sample_rate', 16000)
            : (int) config('voice.audio.output_sample_rate', 24000);

        $wavPath = $this->dirPath($session)."/{$channel}.wav";

        // local 磁盘就是真实文件系统，直接取路径流式读写，避免整文件载入内存
        $pcmFullPath = Storage::disk('local')->path($pcmPath);
        $wavFullPath = Storage::disk('local')->path($wavPath);

        $in = fopen($pcmFullPath, 'rb');
        $out = fopen($wavFullPath, 'wb');

        if ($in === false || $out === false) {
            if (is_resource($in)) {
                fclose($in);
            }

            if (is_resource($out)) {
                fclose($out);
            }

            throw new RuntimeException('无法打开音频文件进行封存。');
        }

        try {
            $pcmSize = filesize($pcmFullPath) ?: 0;

            fwrite($out, $this->wavHeader($pcmSize, $sampleRate));

            while (! feof($in)) {
                $chunk = fread($in, 1024 * 1024);

                if ($chunk !== false && $chunk !== '') {
                    fwrite($out, $chunk);
                }
            }
        } finally {
            fclose($in);
            fclose($out);
        }

        // 封存后清理 PCM 临时文件，避免双份占用
        Storage::disk('local')->delete($pcmPath);

        return $wavPath;
    }

    /** 生成 16-bit mono PCM 的 WAV 头（44 字节）。 */
    private function wavHeader(int $pcmSize, int $sampleRate): string
    {
        $byteRate = $sampleRate * 2; // mono, 16-bit
        $dataSize = $pcmSize;
        $riffSize = 36 + $dataSize;

        return pack('A4VA4A4VvvVVvvA4V',
            'RIFF', $riffSize, 'WAVE', 'fmt ', 16, 1, 1,
            $sampleRate, $byteRate, 2, 16,
            'data', $dataSize
        );
    }

    private function addQuota(int $visitorId, int $seconds): void
    {
        if ($seconds <= 0) {
            return;
        }

        VoiceQuota::updateOrCreate(
            ['visitor_id' => $visitorId, 'date' => today()->toDateString()],
            [],
        )->increment('used_seconds', $seconds);
    }

    private function dirPath(ConversationSession $session): string
    {
        return self::DIR_PREFIX.'/'.$session->id;
    }

    private function pcmPath(ConversationSession $session, string $channel): string
    {
        return $this->dirPath($session)."/{$channel}.pcm";
    }

    private function assertChannel(string $channel): void
    {
        if (! in_array($channel, ['student', 'ai'], true)) {
            throw new RuntimeException("非法音频通道 [{$channel}]。");
        }
    }
}
