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
        'sample_rate' => 16000,             // 学生输入 PCM 采样率（16kHz，供应商要求）
        'output_sample_rate' => 24000,      // AI 输出 PCM 采样率（24kHz，供应商固定，不可改）
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
            // 可选模型（以官方文档为准）：qwen3-omni-flash-realtime（默认，性价比高）、
            // qwen3.5-omni-flash-realtime / qwen3.5-omni-plus-realtime（新一代）。
            'model' => env('VOICE_QWEN_OMNI_MODEL', 'qwen3-omni-flash-realtime'),
            'ws_url' => env('VOICE_QWEN_OMNI_WS_URL', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'),
            // 官方鉴权是 Authorization: Bearer <API-Key> 请求头；浏览器 WebSocket 无法自定义
            // 请求头，直连模式下只能把凭据放进 URL query 参数（参数名以实测为准）。
            // 若服务端拒绝 query 鉴权：生产环境改用 STS 临时凭证签名，或走服务器中继。
            'auth_query_param' => env('VOICE_QWEN_OMNI_AUTH_QUERY_PARAM', 'api-key'),
            'token_ttl_seconds' => (int) env('VOICE_QWEN_OMNI_TOKEN_TTL', 600),
            'voice' => env('VOICE_QWEN_OMNI_VOICE', 'Cherry'),
            'language' => 'en-US',
            // 服务端 VAD（server_vad）：自动判断话轮、说话结束自动提交、学生插话自动打断
            'vad' => [
                'type' => 'server_vad',
                'threshold' => (float) env('VOICE_QWEN_OMNI_VAD_THRESHOLD', 0.5),
                'prefix_padding_ms' => 300,
                'silence_duration_ms' => (int) env('VOICE_QWEN_OMNI_VAD_SILENCE_MS', 800),
                'create_response' => true,
                'interrupt_response' => true,
            ],
            'temperature' => (float) env('VOICE_QWEN_OMNI_TEMPERATURE', 0.7),
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
