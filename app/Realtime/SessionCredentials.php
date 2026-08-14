<?php

namespace App\Realtime;

/**
 * 浏览器直连语音服务商所需的连接凭据（统一结构，与供应商解耦）。
 */
final readonly class SessionCredentials
{
    public function __construct(
        public string $provider,
        public string $wsUrl,
        public string $token,
        public ?int $expiresAt = null, // unix timestamp，null 表示不主动过期
        public array $extra = [],      // 供应商特定参数（model/voice/language...）
    ) {
    }

    public function toArray(): array
    {
        return [
            'provider' => $this->provider,
            'ws_url' => $this->wsUrl,
            'token' => $this->token,
            'expires_at' => $this->expiresAt,
            ...$this->extra,
        ];
    }
}
