# 实时语音英语对话 · 阶段一技术规划

> 目标用户：小学生英语会话练习（内部使用）
> 技术栈：Laravel 13 + PHP 8.5 + Inertia + Vue 3
> 阶段一范围：纯实时对话闭环（说话 → AI 实时听懂并语音回复 → 可打断）
> 已确认决策：
> 1. 语音服务商做可插拔网关，先接国内服务商（阿里百炼 Qwen3-Omni Realtime 优先，备选火山豆包）
> 2. 前端 Inertia + Vue 3；先本地开发，架构兼容国内云
> 3. **免注册**：访客模式（昵称/年级可选填），后端记录访客与会话数据
> 4. **保留对话音频**：双通道（学生 + AI）录音落盘，支持后台回放

---

## 1. 总体架构

```
┌──────────────────────────── 浏览器 (Inertia + Vue 3) ────────────────────────────┐
│                                                                                   │
│  getUserMedia ─► AudioWorklet 16kHz/mono PCM ──┬─► WS 客户端（音频双向流）          │
│                                                └─► WAV 缓冲（学生录音 tee 分流）      │
│  AI 音频帧（PCM）──┬─► AudioContext 播放队列                                        │
│                   └─► WAV 缓冲（AI 录音）                                           │
│  本地 VAD ─► 打断(barge-in)     双语字幕 ◄── ASR/LLM 文本事件                        │
│  分片上传器：每 ~20s 把两类 WAV 增量上传，结束时传 timeline.json                      │
│                                                                                   │
└──────────────┬──────────────────────────┬───────────────────────────▲────────────┘
               │ ① 音频 WS 直连（临时token） │ ② 录音分片上传（HTTP 追加写） │ ③ Inertia/JSON
               ▼                          ▼                           │
┌───────────────────────────┐  ┌───────────────────────────────────────────────────┐
│ 语音服务商（可插拔）         │  │ Laravel 13 后端 (PHP 8.5)                          │
│ · 百炼 Qwen3-Omni（首选）   │  │ · 访客体系（签名 Cookie + visitors 表）               │
│ · 火山豆包（备选）          │  │ · Provider 抽象 + 临时 token 签发                    │
│ · OpenAI/Gemini（后续）     │  │ · 录音分片追加写 → 会话结束合并落盘                    │
└───────────────────────────┘  │ · 场景/会话/回合 + 配额 + 管理端查看回放               │
                               │ · Reverb（可选，只做事件不做音频）                     │
                               └───────────────────────────────────────────────────┘
```

核心决策不变：**音频帧不走 Laravel/Reverb**，浏览器凭临时 token 直连供应商。新增的录音链路在**浏览器侧 tee 分流**（同一份 PCM 既发 WS 又进 WAV 缓冲），分片上传到 Laravel 追加写盘 —— 即使标签页中途崩溃，已上传的片段也不丢。未来若加服务器中继层，录音可整体下沉到服务端（更简单、零上传），Provider 抽象已为此留位。

## 2. 技术选型明细

| 层 | 选择 | 说明 |
|---|---|---|
| 后端框架 | Laravel 13 | 本地 PHP 8.5；开发用 `php artisan dev`（一键起 server/queue/logs/vite）或 Herd |
| 前端 | Inertia + Vue 3 + TypeScript + Tailwind | Laravel 官方 starter kit（Vue 变体），免注册模式可不用其 auth 页面 |
| 实时事件 | Laravel Reverb（可选，阶段一弱化） | 会话状态/心跳/未来教师端；**不传音频帧** |
| 音频传输 | 浏览器 WebSocket 直连供应商 | 临时 token 由后端签发；16kHz mono PCM |
| 语音服务商 | 百炼 Qwen3-Omni Realtime（首选） | 双向 WS、支持打断、国内稳定；备选火山豆包 |
| 后台管理 | Filament v4（可选）或自建简单列表页 | 内部查看访客/会话记录 + 音频回放 |

## 3. 可插拔网关抽象（核心设计）

```
App\Realtime\Contracts\RealtimeVoiceProvider
  ├─ config(): ProviderConfig          // id、name、wsUrl 模板、鉴权方式
  ├─ issueSessionToken(Session): Credentials   // {url, token, expiresAt}
  ├─ buildSystemPrompt(Scenario, Visitor): string
  └─ normalizeEvent(array): ?TurnEvent        // 供应商事件 → 统一字幕/回合事件

实现：QwenOmniProvider、DoubaoProvider、(后续) OpenAiRealtimeProvider
工厂：RealtimeProviderManager::driver(config('voice.provider'))
```

- 前端只认统一的 `{ws_url, token, expires_at}` 连接凭据，不感知供应商差异。
- 事件规范化把各家的 ASR/LLM/音频事件映射成统一结构，字幕与落库逻辑与供应商解耦。
- 直连模式下**禁止把 API Key 下发浏览器**：优先用供应商临时 token/STS 凭证；某供应商不支持临时凭证时，该 provider 走中继模式。

## 4. 数据模型

| 表 | 关键字段 | 说明 |
|---|---|---|
| visitors | id(uuid)、nickname?、grade?、ip、user_agent、first_seen、last_seen、session_count | 免注册访客，签名 Cookie 识别 |
| scenarios | name、slug、level、system_prompt、target_vocab(json)、voice_config(json) | 场景库 |
| conversation_sessions | visitor_id、scenario_id、provider、status、started_at、ended_at、duration_s、turn_count、**student_audio_path、ai_audio_path、timeline_path** | 预留 user_id 可空字段，将来接账号体系 |
| conversation_turns | session_id、seq、speaker(student/assistant)、text、start_ms、end_ms、latency_ms | 与 timeline 对齐 |
| voice_quotas | visitor_id、date、used_seconds | 每日用量（内部使用建议 60 分钟/天，可配置） |

**录音存储布局**（内部使用，放私有磁盘）：

```
storage/app/private/voice/{session_id}/
├── student.wav      # 学生麦克风录音（16kHz mono PCM→WAV）
├── ai.wav           # AI 语音录音（收到的 PCM 帧→WAV）
└── timeline.json    # 回合时间线：[{seq, speaker, text, start_ms, end_ms}]
```

- 双通道分开存，便于将来逐句评分对齐；回放时前端按 timeline 同步播放两轨。
- 容量估算：单通道 WAV ≈ 1.9MB/分钟，30 分钟会话双通道 ≈ 115MB。内部使用可接受；若存储吃紧，加一个 WAV→opus 的后台转码任务即可（阶段二再做）。

## 5. 访客体系（免注册）

- 首次打开页面：可选填昵称 + 年级（用于难度与称呼），`POST /api/voice/visitors` 建立 visitor 记录，下发**签名 Cookie**（如 `voice_visitor_id`，Laravel 自带 `Cookie::make` + 校验）。
- 后续请求凭 Cookie 识别同一访客；后端同时记录 IP / UA / 来源页，便于内部盘点「谁在用、用了多久」。
- 配额挂在 visitor 上；同一设备同浏览器视为同一访客（内部使用，无需强实名）。
- 隐私提示：内部使用仍遵循最小化——不收集手机号等实名信息，录音仅内部可见。

## 6. 教学设计（儿童英语会话）

- **场景库**：打招呼/自我介绍、餐厅点餐、动物园、校园生活……每个场景带目标词汇与语法难度（L1~L3），年级可选填用于默认难度。
- **System Prompt 要点**：小学课标词汇、短句、语速适中；温柔鼓励式纠错（"Almost! Try saying..."）；跑题时温和拉回场景；禁止聊学习无关/成人话题。
- **音色**：温和女声/童声，参数统一放 `scenarios.voice_config`。
- **打断（barge-in）**：学生开口即暂停 AI 播放并取消生成——实时对话感的核心，阶段一必须做。

## 7. 前端语音模块设计

| 模块 | 职责 |
|---|---|
| `audio/recorder.ts` | getUserMedia + AudioWorklet 采集；16kHz mono PCM **tee 分流**：发 WS + 进 WAV 编码缓冲 |
| `audio/player.ts` | AudioContext 双缓冲播放队列；AI PCM 帧同时进 WAV 缓冲；首帧前解锁 autoplay 策略 |
| `audio/wav.ts` | 轻量 WAV 编码器（PCM→WAV 头 + 数据） |
| `audio/uploader.ts` | 每 ~20s 或缓冲达 2MB 时 POST 分片追加写；断线重试；结束时上传 timeline.json |
| `audio/barge.ts` | 回声自适应打断检测：回声比（mic/AI 能量）采样收敛 + 连续 6 帧确认，替代固定阈值，大幅降低误截断 |
| `composables/useVoiceChat.ts` | 状态机 `idle→connecting→ready→listening⇄thinking/speaking→interrupted→ended`；断线重连、token 过期重签 |
| 界面 | 开始/结束大按钮、卡通头像动画、双语字幕、计时、结束反馈 |

回声与降噪：采集开启 `echoCancellation / noiseSuppression / autoGainControl`。

打断（barge-in）实现要点：AI 说话期间麦克风帧一律不上行（防回声/噪声触发服务端 VAD 取消生成）；打断由本地回声自适应检测（`audio/barge.ts`）连续 6 帧确认后主动发 `response.cancel`；播放器 40ms 淡出防爆音；取消后 2 秒未确认则恢复音频放行兜底。

## 8. 后端接口

| 方法 | 路由 | 说明 |
|---|---|---|
| POST | `/api/voice/visitors` | 建访客（昵称/年级可选），下发签名 Cookie |
| GET | `/api/voice/scenarios` | 场景列表 |
| POST | `/api/voice/sessions` | 建会话 + 签临时 token，返回 `{session_id, provider, ws_url, token, expires_at}` |
| POST | `/api/voice/sessions/{id}/audio/{channel}` | 录音分片追加写（channel=student\|ai，请求带 seq 幂等去重），私有磁盘 append |
| POST | `/api/voice/sessions/{id}/turns` | 字幕/回合文本落库 |
| POST | `/api/voice/sessions/{id}/end` | 结束：上传 timeline.json、封存音频、统计时长回合数 |
| GET | `/admin/visitors` `/admin/sessions` | 内部管理：访客列表、会话记录、双轨回放（Filament 或自建页） |
| 中间件 | `VoiceQuota` | 按 visitor 每日时长限制，超限拒绝新会话 |

## 9. 安全与合规

- 儿童内容护栏：prompt 层限制话题 + 供应商内容安全参数（百炼/豆包均有审核开关）。
- 文本与音频审计：转写全文入库、录音私有磁盘保存，仅内部管理端可见。
- 访客数据最小化：Cookie 匿名 ID + IP/UA，不收集实名信息。
- 鉴权：临时 token 短时效（10 分钟）+ 会话中途过期由后端重签；音频上传接口校验会话归属 Cookie。

## 10. 里程碑（约 2~2.5 周）

| # | 内容 | 估时 |
|---|---|---|
| 1 | Laravel 13 脚手架（Vue/Inertia/TS/Tailwind）+ `artisan dev` 跑通 | 0.5d |
| 2 | 访客体系（Cookie + visitors 表）+ 数据模型 + 场景库（3~5 个场景） | 1.5d |
| 3 | Provider 抽象 + QwenOmni 实现 + token 签发 + 事件规范化 | 1~2d |
| 4 | 前端采集/播放/WS 客户端 + useVoiceChat 状态机 | 2~3d |
| 5 | 打断 + 双语字幕 + 会话落库 | 1~2d |
| 6 | 双通道录音（WAV 缓冲 + 分片上传 + timeline）+ 结束封存 | 1~1.5d |
| 7 | 配额 + 管理端（访客/会话列表 + 双轨回放） | 1~2d |
| 8 | 联调：延迟、断线重连、录音完整性 | 1d |

## 11. 风险与注意点

1. **麦克风权限**：`getUserMedia` 要求 secure context——`localhost` 可用；手机局域网测试需 HTTPS（Herd 自带 .test 证书）。
2. **自动播放策略**：需用户手势后出声——点「开始」时先放静音解锁 AudioContext。
3. **录音分片上传**：分片需带 seq 幂等；会话被强关时已上传片段保留，损失只在最后一个间隔内（≤20s）。
4. **PHP 8.5 生态坑**：阶段一不引入 Swoole；未来中继层优先 Node/Bun 或 RoadRunner。
5. **Reverb 定位**：事件通道，不适合每秒 25~100 个音频帧，音频只走专用 WS。
6. **供应商稳定性**：WS 断线重连、token 过期重签、限流退避。
7. **存储增长**：内部使用先全量 WAV；量大了加后台 opus 转码 + 过期归档策略。
8. **延迟目标**：学生说完 → AI 首字出声 < 1.5s（直连国内供应商最容易达标）。

## 12. 阶段二展望（本次不做）

逐句发音评分（与已存录音直接对齐）、对话后词汇/语法报告、Reverb 教师端实时监课（presence + 字幕流）、家长角色与实名班级、录音服务端化（中继模式顺带完成）+ opus 转码归档。
