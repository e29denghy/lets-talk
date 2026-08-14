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
    | 服务器中继（浏览器 → 中继 → 语音服务商）
    |--------------------------------------------------------------------------
    | 官方端点只接受 Authorization: Bearer 头鉴权（实测 query 鉴权 401），
    | 浏览器 WebSocket 无法自定义请求头，因此直连不可行：
    | 浏览器连本机中继（scripts/voice-relay.mjs，TLS 复用 Valet 证书），
    | 中继校验会话后带 Bearer 头连上游并双向转发。API Key 只到达中继。
    */
    'relay' => [
        'enabled' => (bool) env('VOICE_RELAY_ENABLED', true),
        'ws_url' => env('VOICE_RELAY_WS_URL', 'wss://lets-talk.test:9333'),
        // 中继与 Laravel 之间的共享密钥（relay-init 校验用），空则拒绝所有中继请求
        'secret' => env('VOICE_RELAY_SECRET'),
    ],

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
    | 供应商计费单价（人民币 / 百万 token，用于会话成本估算）
    |--------------------------------------------------------------------------
    | qwen3-omni-flash-realtime（百炼官方定价，用户提供）：
    |   输入-音频 ¥27、输入-文本 ¥3.3、输出-文本+音频 ¥107（输出的文本不计费）、
    |   纯文本输出 ¥20（实时语音模式下输出文本不计费，按 0 处理）。
    */
    'pricing' => [
        'qwen_omni' => [
            'input_audio_rmb_per_1m' => 27.0,
            'input_text_rmb_per_1m' => 3.3,
            'output_audio_rmb_per_1m' => 107.0,
            'output_text_rmb_per_1m' => 0.0, // 实时语音输出的文本不计费；纯文本输出为 ¥20/1M
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | 儿童对话护栏（按语言附加在场景 system prompt 之后）
    |--------------------------------------------------------------------------
    */
    'guardrails' => [
        'en' => [
            'Speak VERY slowly and clearly, like talking to a young child who is just starting to learn English. Pause briefly between sentences.',
            'Each reply must be at most TWO or THREE short sentences. Ask only ONE question per reply.',
            'Only use simple English words suitable for a primary school student.',
            'Gently correct mistakes in an encouraging way, e.g. "Almost! Try saying ...".',
            'Stay on the practice topic; if the child drifts away, kindly bring the conversation back.',
            'Never discuss adult, violent, political, or any topic unsuitable for children.',
            'If the child is stuck or silent for a long time, offer a friendly hint or repeat the question slowly.',
            'The child may switch between Chinese and English at any time. Always reply in the language the child just used. If the child asks to switch languages (for example "speak English" or "说中文"), switch immediately and briefly confirm in the new language.',
        ],
        'zh' => [
            '全程使用中文交流，用词简单、句子简短，适合小学生。',
            '语速要非常慢、吐字清晰，像在跟刚开始学说话的小朋友讲话，句与句之间稍作停顿。',
            '每次回复最多两到三句短句，一次只问一个问题。',
            '用温和鼓励的方式纠正错误，例如「真棒！这句话这样说更好：……」。',
            '围绕当前练习话题展开；孩子跑题时，温和地把话题拉回来。',
            '绝不讨论成人、暴力、政治等任何不适合儿童的内容。',
            '孩子卡住或长时间沉默时，友好地给一点提示，或放慢语速重复问题。',
            '孩子随时可以在中文和英文之间切换。始终用孩子刚刚使用的语言回复。如果孩子要求切换语言（例如「说中文」或"speak English"），立即切换并用新语言简短确认。',
        ],
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
            'model' => env('VOICE_QWEN_OMNI_MODEL', 'qwen3.5-omni-flash-realtime'),
            'ws_url' => env('VOICE_QWEN_OMNI_WS_URL', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'),
            // 官方鉴权是 Authorization: Bearer <API-Key> 请求头；浏览器 WebSocket 无法自定义
            // 请求头，直连模式下只能把凭据放进 URL query 参数（参数名以实测为准）。
            // 若服务端拒绝 query 鉴权：生产环境改用 STS 临时凭证签名，或走服务器中继。
            'auth_query_param' => env('VOICE_QWEN_OMNI_AUTH_QUERY_PARAM', 'api-key'),
            'token_ttl_seconds' => (int) env('VOICE_QWEN_OMNI_TOKEN_TTL', 600),
            // 儿童友好音色（qwen3.5 实测可用：Serena/Ethan/Tina；Cherry/Chelsie 不支持）
            'voice' => env('VOICE_QWEN_OMNI_VOICE', 'Serena'),
            'language' => 'en-US',
            // 回复长度硬上限（配合护栏的「一两句短句」提示，防止长篇大论）
            'max_tokens' => (int) env('VOICE_QWEN_OMNI_MAX_TOKENS', 150),
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
