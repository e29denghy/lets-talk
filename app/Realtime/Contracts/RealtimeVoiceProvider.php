<?php

namespace App\Realtime\Contracts;

use App\Models\ConversationSession;
use App\Models\Scenario;
use App\Models\Visitor;
use App\Realtime\SessionCredentials;

/**
 * 实时语音服务商统一契约。
 *
 * 实现类负责：
 *  1. 签发浏览器直连用的临时连接凭据（不把长期密钥下发前端）；
 *  2. 组装儿童英语场景的 system prompt；
 *  3. 把供应商特有的 WS 事件规范化为统一结构（字幕/回合）。
 */
interface RealtimeVoiceProvider
{
    /** 供应商标识（config/voice.php 中的 key）。 */
    public function name(): string;

    /** 为一次会话签发直连凭据。 */
    public function issueSessionToken(ConversationSession $session): SessionCredentials;

    /** 组装会话 system prompt（场景模板 + 访客信息 + 通用护栏）。 */
    public function buildSystemPrompt(Scenario $scenario, Visitor $visitor): string;

    /**
     * 供应商 WS 事件 → 统一事件结构。
     * 返回 ['speaker' => 'student'|'assistant', 'kind' => 'transcript', 'text' => ...]
     * 非字幕/回合事件返回 null。
     */
    public function normalizeEvent(array $event): ?array;
}
