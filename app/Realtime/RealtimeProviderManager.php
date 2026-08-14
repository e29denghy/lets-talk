<?php

namespace App\Realtime;

use App\Realtime\Contracts\RealtimeVoiceProvider;
use InvalidArgumentException;

/**
 * 语音服务商工厂：按 config('voice.provider') 解析当前 driver。
 */
class RealtimeProviderManager
{
    public function driver(?string $name = null): RealtimeVoiceProvider
    {
        $name ??= config('voice.provider');

        $config = config("voice.providers.{$name}");

        if (! is_array($config) || empty($config['driver'])) {
            throw new InvalidArgumentException("语音服务商 [{$name}] 未在 config/voice.php 中配置。");
        }

        return app($config['driver'], [
            'config' => $config,
            'providerName' => $name,
        ]);
    }
}
