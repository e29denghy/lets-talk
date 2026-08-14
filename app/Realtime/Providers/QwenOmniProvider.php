<?php

namespace App\Realtime\Providers;

use App\Models\ConversationSession;
use App\Models\Scenario;
use App\Models\Visitor;
use App\Realtime\Contracts\RealtimeVoiceProvider;
use App\Realtime\SessionCredentials;
use Illuminate\Support\Arr;
use RuntimeException;

/**
 * 阿里云百炼 Qwen3-Omni Realtime。
 *
 * 官方文档：https://help.aliyun.com/zh/model-studio/omni/
 *
 * 注意：浏览器 WebSocket 无法自定义 Authorization Header，因此直连模式下
 * 凭据只能放在 URL query 参数中。内部开发可临时用 API Key（由服务端拼 URL），
 * 生产环境必须切换为阿里云 STS 临时凭证（config: sts_enabled），
 * 或升级为服务器中继模式（阶段二）。
 */
class QwenOmniProvider implements RealtimeVoiceProvider
{
    public function __construct(
        protected array $config,
        protected string $providerName,
    ) {
    }

    public function name(): string
    {
        return $this->providerName;
    }

    public function issueSessionToken(ConversationSession $session): SessionCredentials
    {
        $token = $this->resolveToken();

        $query = Arr::query([
            'model' => $this->config['model'],
            $this->config['auth_query_param'] => $token,
        ]);

        $wsUrl = $this->config['ws_url']
            .(str_contains($this->config['ws_url'], '?') ? '&' : '?')
            .$query;

        return new SessionCredentials(
            provider: $this->name(),
            wsUrl: $wsUrl,
            token: $token,
            expiresAt: now()->addSeconds((int) ($this->config['token_ttl_seconds'] ?? 600))->timestamp,
            extra: [
                'model' => $this->config['model'],
                'voice' => $this->config['voice'] ?? 'Cherry',
                'language' => $this->config['language'] ?? 'en-US',
                'sample_rate' => (int) config('voice.audio.sample_rate', 16000),
                'output_sample_rate' => (int) config('voice.audio.output_sample_rate', 24000),
                // 收到 session.created 后客户端要发送的会话配置（instructions 由客户端填 system_prompt）。
                // 字段对齐官方实时多模态 API 文档（2026-07 版）。
                'session_init' => [
                    'type' => 'session.update',
                    'session' => [
                        'modalities' => ['text', 'audio'],
                        'instructions' => null,
                        'voice' => $this->config['voice'] ?? 'Cherry',
                        'input_audio_format' => 'pcm',   // 16kHz 输入
                        'output_audio_format' => 'pcm',  // 24kHz 输出
                        'input_audio_transcription' => [
                            'model' => 'qwen3-asr-flash-realtime',
                        ],
                        'turn_detection' => $this->config['vad'] ?? null, // server_vad 自动话轮/打断
                        'temperature' => (float) ($this->config['temperature'] ?? 0.7),
                    ],
                ],
            ],
        );
    }

    public function buildSystemPrompt(Scenario $scenario, Visitor $visitor): string
    {
        $prompt = strtr($scenario->system_prompt, [
            '{nickname}' => $visitor->nickname ?: 'friend',
            '{grade}' => $visitor->grade ? "Grade {$visitor->grade}" : 'a primary school student',
        ]);

        $guardrails = config('voice.guardrails', []);

        if ($guardrails !== []) {
            $prompt .= "\n\nRules:\n- ".implode("\n- ", $guardrails);
        }

        return $prompt;
    }

    public function normalizeEvent(array $event): ?array
    {
        // 事件名以官方 server events 文档为准，接入联调时按实际事件核对调整。
        $type = $event['type'] ?? '';

        // 学生一句话转写完成（最终文本）
        if ($type === 'conversation.item.input_audio_transcription.completed') {
            $text = (string) data_get($event, 'transcript', '');

            return $text !== '' ? ['speaker' => 'student', 'kind' => 'transcript', 'text' => $text] : null;
        }

        // AI 回复转写完成（最终文本）
        if ($type === 'response.audio_transcript.done') {
            $text = (string) data_get($event, 'transcript', '');

            return $text !== '' ? ['speaker' => 'assistant', 'kind' => 'transcript', 'text' => $text] : null;
        }

        return null;
    }

    protected function resolveToken(): string
    {
        $token = $this->config['api_key'] ?? '';

        if ($token === '' || $token === null) {
            throw new RuntimeException(
                'Qwen-Omni 未配置 API Key。请在 .env 中设置 VOICE_QWEN_OMNI_API_KEY（或启用 STS）。'
            );
        }

        return $token;
    }
}
