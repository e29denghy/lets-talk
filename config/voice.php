<?php

return [

    /*
    |--------------------------------------------------------------------------
    | 默认语音服务商（可插拔网关）
    |--------------------------------------------------------------------------
    | 浏览器只认统一的连接凭据 {ws_url, token, expires_at}，不感知供应商差异。
    | 切换供应商只需改 VOICE_PROVIDER 环境变量。
    */
    'provider' => env('VOICE_PROVIDER', 'qwen_omni'),

    /*
    |--------------------------------------------------------------------------
    | 音频参数（浏览器侧采集/编码）
    |--------------------------------------------------------------------------
    */
    'audio' => [
        'sample_rate' => 16000,             // 采集与上行 PCM 采样率（Hz）
        'chunk_interval_seconds' => 20,     // 录音分片上传间隔
        'max_chunk_bytes' => 2 * 1024 * 1024, // 达到该大小立即上传
    ],

    /*
    |--------------------------------------------------------------------------
    | 用量配额（挂在访客上）
    |--------------------------------------------------------------------------
    */
    'quota' => [
        'daily_seconds' => (int) env('VOICE_DAILY_QUOTA_SECONDS', 3600),   // 每日 60 分钟
        'max_session_seconds' => (int) env('VOICE_MAX_SESSION_SECONDS', 1800), // 单会话 30 分钟
    ],

    /*
    |--------------------------------------------------------------------------
    | 儿童对话护栏（附加在场景 system prompt 之后）
    |--------------------------------------------------------------------------
    */
    'guardrails' => [
        'Only use simple English words suitable for a primary school student.',
        'Keep sentences short and speak at a natural, moderate pace.',
        'Gently correct mistakes in an encouraging way, e.g. "Almost! Try saying ...".',
        'Stay on the practice topic; if the child drifts away, kindly bring the conversation back.',
        'Never discuss adult, violent, political, or any topic unsuitable for children.',
        'If the child is stuck or silent for a long time, offer a friendly hint or repeat the question slowly.',
    ],

    /*
    |--------------------------------------------------------------------------
    | 供应商配置
    |--------------------------------------------------------------------------
    */
    'providers' => [

        // 阿里云百炼 Qwen3-Omni Realtime（首选）
        // 官方文档：https://help.aliyun.com/zh/model-studio/omni/
        'qwen_omni' => [
            'driver' => App\Realtime\Providers\QwenOmniProvider::class,
            'api_key' => env('VOICE_QWEN_OMNI_API_KEY'),
            'model' => env('VOICE_QWEN_OMNI_MODEL', 'qwen3-omni-flash-realtime'),
            'ws_url' => env('VOICE_QWEN_OMNI_WS_URL', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'),
            // 浏览器 WebSocket 无法自定义 Header，token 只能走 query 参数；
            // 鉴权参数名以官方实时文档为准（接入时核对）。
            'auth_query_param' => env('VOICE_QWEN_OMNI_AUTH_QUERY_PARAM', 'api-key'),
            'token_ttl_seconds' => (int) env('VOICE_QWEN_OMNI_TOKEN_TTL', 600),
            'voice' => env('VOICE_QWEN_OMNI_VOICE', 'Cherry'),
            'language' => 'en-US',
            // 生产环境应改用阿里云 STS 临时凭证，禁止把长期 API Key 下发浏览器。
            'sts_enabled' => (bool) env('VOICE_QWEN_OMNI_STS_ENABLED', false),
        ],

        // 火山引擎豆包实时语音（备选）
        // 官方文档：https://docs.volcengine.com/docs/6561/1594356?lang=zh
        'doubao' => [
            'driver' => App\Realtime\Providers\DoubaoProvider::class,
            'app_id' => env('VOICE_DOUBAO_APP_ID'),
            'access_token' => env('VOICE_DOUBAO_ACCESS_TOKEN'),
            'ws_url' => env('VOICE_DOUBAO_WS_URL', 'wss://openspeech.bytedance.com/api/v3/realtime/translation'),
            'cluster' => env('VOICE_DOUBAO_CLUSTER', 'volc_voiceroom'),
            'token_ttl_seconds' => (int) env('VOICE_DOUBAO_TOKEN_TTL', 600),
        ],

    ],
];
