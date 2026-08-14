<?php

namespace Tests\Support;

use App\Models\ConversationSession;
use App\Models\Scenario;
use App\Models\Visitor;
use App\Realtime\Contracts\RealtimeVoiceProvider;
use App\Realtime\SessionCredentials;

/**
 * 测试用假语音服务商：不发真实网络请求，返回固定凭据。
 */
class FakeVoiceProvider implements RealtimeVoiceProvider
{
    public function name(): string
    {
        return 'fake';
    }

    public function issueSessionToken(ConversationSession $session): SessionCredentials
    {
        return new SessionCredentials(
            provider: 'fake',
            wsUrl: 'wss://fake.example.test/realtime?token=test',
            token: 'test-token',
            expiresAt: now()->addMinutes(10)->timestamp,
            extra: [
                'model' => 'fake-model',
                'voice' => 'Fake',
                'sample_rate' => 16000,
                'session_init' => [
                    'type' => 'session.update',
                    'session' => [
                        'modalities' => ['audio', 'text'],
                        'instructions' => null,
                        'voice' => 'Fake',
                    ],
                ],
            ],
        );
    }

    public function buildSystemPrompt(Scenario $scenario, Visitor $visitor): string
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
