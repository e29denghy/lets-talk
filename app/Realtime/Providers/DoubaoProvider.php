<?php

namespace App\Realtime\Providers;

use App\Models\ConversationSession;
use App\Models\Scenario;
use App\Models\Visitor;
use App\Realtime\Contracts\RealtimeVoiceProvider;
use App\Realtime\SessionCredentials;
use RuntimeException;

/**
 * 火山引擎豆包实时语音（备选供应商，占位实现）。
 *
 * 官方文档：https://docs.volcengine.com/docs/6561/1594356?lang=zh
 * 接入时按文档实现：临时 token 获取、WS 建连、事件规范化
 * （参照 QwenOmniProvider 与前端 lib/providers/ 适配层）。
 */
class DoubaoProvider implements RealtimeVoiceProvider
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
        throw new RuntimeException('豆包实时语音尚未接入，请参考官方文档实现 DoubaoProvider。');
    }

    public function upstreamCredentials(ConversationSession $session): array
    {
        throw new RuntimeException('豆包实时语音尚未接入，请参考官方文档实现 DoubaoProvider。');
    }

    public function buildSystemPrompt(Scenario $scenario, Visitor $visitor, string $language = 'en'): string
    {
        return strtr($scenario->system_prompt, [
            '{nickname}' => $visitor->nickname ?: 'friend',
            '{grade}' => $visitor->grade ? "Grade {$visitor->grade}" : 'a primary school student',
        ]);
    }

    public function normalizeEvent(array $event): ?array
    {
        return null;
    }
}
