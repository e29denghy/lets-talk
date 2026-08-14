<?php

namespace App\Http\Controllers\Api\Voice;

use App\Http\Controllers\Controller;
use App\Models\ConversationSession;
use App\Models\Scenario;
use App\Models\Visitor;
use App\Models\VoiceQuota;
use App\Realtime\RealtimeProviderManager;
use App\Services\VoiceSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SessionController extends Controller
{
    public function __construct(private VoiceSessionService $sessions)
    {
    }

    /** 开始会话：建记录 + 签发供应商直连凭据。 */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'scenario_id' => ['required', 'integer', 'exists:scenarios,id'],
        ]);

        /** @var Visitor $visitor */
        $visitor = app('voice.visitor');

        $scenario = Scenario::query()
            ->where('id', $data['scenario_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $result = $this->sessions->start($visitor, $scenario);

        $quota = VoiceQuota::where('visitor_id', $visitor->id)
            ->where('date', today()->toDateString())
            ->first();

        return response()->json([
            'session' => [
                'id' => $result['session']->id,
                'status' => $result['session']->status,
                'started_at' => $result['session']->started_at?->toIso8601String(),
            ],
            'credentials' => $result['credentials'],
            'system_prompt' => $result['system_prompt'],
            'voice_config' => $result['voice_config'],
            'audio' => [
                'sample_rate' => (int) config('voice.audio.sample_rate', 16000),
                'chunk_interval_seconds' => (int) config('voice.audio.chunk_interval_seconds', 20),
                'max_chunk_bytes' => (int) config('voice.audio.max_chunk_bytes'),
            ],
            'quota' => [
                'used_seconds' => (int) ($quota->used_seconds ?? 0),
                'limit_seconds' => (int) config('voice.quota.daily_seconds'),
            ],
        ], 201);
    }

    /**
     * 录音分片追加写（原始字节，application/octet-stream）。
     * channel: student|ai；seq 走 query 参数，幂等去重。
     */
    public function appendAudio(Request $request, ConversationSession $session, string $channel): JsonResponse
    {
        $this->ensureOwned($session);
        $this->ensureActive($session);

        $data = $request->validate([
            'seq' => ['required', 'integer', 'min:0'],
            'channel' => ['in:student,ai'],
        ]);

        $channel = $data['channel'] ?? $channel;

        $maxBytes = (int) config('voice.audio.max_chunk_bytes', 2 * 1024 * 1024) * 2;
        $bytes = $request->getContent();

        if (strlen($bytes) > $maxBytes) {
            return response()->json(['message' => '音频分片过大。'], Response::HTTP_REQUEST_ENTITY_TOO_LARGE);
        }

        $result = $this->sessions->appendAudioChunk($session, $channel, (int) $data['seq'], $bytes);

        return response()->json([
            ...$result,
            'uploaded_total' => $this->sessions->uploadedBytes($session, $channel),
        ]);
    }

    /** 断线重连：为进行中的会话重新签发直连凭据（token 短时效，需刷新）。 */
    public function reissue(ConversationSession $session): JsonResponse
    {
        $this->ensureOwned($session);
        $this->ensureActive($session);

        $provider = app(RealtimeProviderManager::class)->driver($session->provider);

        return response()->json([
            'credentials' => $provider->issueSessionToken($session)->toArray(),
        ]);
    }

    /** 批量落库字幕/回合（幂等 upsert）。 */
    public function storeTurns(Request $request, ConversationSession $session): JsonResponse
    {
        $this->ensureOwned($session);
        $this->ensureActive($session);

        $data = $request->validate([
            'turns' => ['required', 'array', 'max:500'],
            'turns.*.seq' => ['required', 'integer', 'min:1'],
            'turns.*.speaker' => ['required', 'in:student,assistant'],
            'turns.*.text' => ['required', 'string', 'max:2000'],
            'turns.*.start_ms' => ['nullable', 'integer', 'min:0'],
            'turns.*.end_ms' => ['nullable', 'integer', 'min:0'],
            'turns.*.latency_ms' => ['nullable', 'integer', 'min:0'],
        ]);

        $count = $this->sessions->storeTurns($session, $data['turns']);

        return response()->json(['stored' => $count]);
    }

    /** 结束会话：封存音频、写 timeline、累计配额。 */
    public function end(Request $request, ConversationSession $session): JsonResponse
    {
        $this->ensureOwned($session);

        $data = $request->validate([
            'timeline' => ['nullable', 'array', 'max:1000'],
        ]);

        $session = $this->sessions->end($session, $data['timeline'] ?? []);

        $quota = VoiceQuota::where('visitor_id', $session->visitor_id)
            ->where('date', today()->toDateString())
            ->first();

        return response()->json([
            'session' => [
                'id' => $session->id,
                'status' => $session->status,
                'duration_s' => $session->duration_s,
                'turn_count' => $session->turn_count,
            ],
            'quota' => [
                'used_seconds' => (int) ($quota->used_seconds ?? 0),
                'limit_seconds' => (int) config('voice.quota.daily_seconds'),
            ],
        ]);
    }

    private function ensureOwned(ConversationSession $session): void
    {
        /** @var Visitor $visitor */
        $visitor = app('voice.visitor');

        abort_unless($session->visitor_id === $visitor->id, Response::HTTP_FORBIDDEN, '无权访问该会话。');
    }

    private function ensureActive(ConversationSession $session): void
    {
        abort_if($session->status === ConversationSession::STATUS_ENDED, Response::HTTP_CONFLICT, '会话已结束。');
    }
}
