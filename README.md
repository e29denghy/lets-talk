# Let's Talk（对话）· 实时语音英语对话练习

面向小学生的英语会话练习（阶段一）：说话 → AI 实时听懂并语音回复 → 可打断，全程双通道录音可回放。

## 技术栈

- **后端**：Laravel 13（PHP 8.5）+ SQLite（本地）/ 可切换 MySQL
- **前端**：Inertia + Vue 3 + TypeScript + Tailwind CSS 4 + Vite
- **语音**：可插拔 `RealtimeVoiceProvider` 网关，默认接阿里云百炼 Qwen3-Omni Realtime（浏览器 WebSocket 直连 + 服务端签发临时凭据）

## 本地启动

> 本机 PHP 8.5 在 `/opt/homebrew/opt/php@8.5/bin/php`（默认 PATH 的 php 是 8.2，Laravel 13 需要 8.3+）。

```bash
cd lets-talk
export PATH="/opt/homebrew/opt/php@8.5/bin:$PATH"

composer install          # 运行依赖已装好；dev 依赖仅缺 pint（代码风格工具，可随时 composer require laravel/pint --dev）
npm install
cp .env.example .env      # 若还没有 .env
php artisan key:generate
php artisan migrate --seed
php artisan test          # 10 个功能测试（假 Provider 全链路，无需真实 API Key）
```

启动（二选一）：

```bash
# A. 快速验证（无需 sudo）
php artisan serve          # http://127.0.0.1:8000 （localhost 属安全上下文，麦克风可用）
npm run dev                # 另开终端跑 Vite HMR

# B. Valet（正式开发环境，需在终端输入密码）
valet use php@8.5          # 让 Valet 用 PHP 8.5（若版本列表无 8.5 用 valet use php）
valet link lets-talk --secure
valet restart
# 然后访问 https://lets-talk.test，npm run dev 提供热更新
```

## 语音服务商配置（.env）

```env
VOICE_PROVIDER=qwen_omni
VOICE_QWEN_OMNI_API_KEY=sk-xxx          # 百炼 API Key（开发用）
VOICE_QWEN_OMNI_MODEL=qwen3-omni-flash-realtime
VOICE_DAILY_QUOTA_SECONDS=3600          # 每访客每日 60 分钟
VOICE_MAX_SESSION_SECONDS=1800          # 单会话 30 分钟
```

- **直连模式**：浏览器 WebSocket 无法带 Header，凭据放 URL query。官方鉴权是 `Authorization: Bearer`
  （[实时多模态 API 文档](https://help.aliyun.com/zh/model-studio/omni-realtime-api)）；
  若服务端拒绝 query 鉴权，**生产必须换阿里云 STS 临时凭证或走服务器中继**（见 `config/voice.php` 注释）。
- **连接探测**：拿到 Key 后先跑 `node scripts/qwen-ws-probe.mjs` 验证端点与鉴权
  （默认 query 模式，`AUTH_MODE=header` 切换 Bearer 模式），再进浏览器联调。
- 协议已按官方文档（2026-07 版）对齐：输入 16kHz PCM、**输出 24kHz PCM**、
  `server_vad` 自动话轮 + 自动打断（`interrupt_response`）、转录模型 `qwen3-asr-flash-realtime`、
  事件字段 `response.audio.delta` 的音频在 `delta` 字段。

## 管理端（内部使用）

- 地址：`/admin`（HTTP Basic 认证）
- 账号：`admin@example.com` / `password`（`DatabaseSeeder` 生成，请改密码）
- 功能：会话记录列表、访客列表（昵称/年级/时长/今日用量）、会话详情 + 双轨录音回放

## 目录速览

```
app/Realtime/                    # 可插拔语音网关
  Contracts/RealtimeVoiceProvider.php   # 供应商统一契约
  RealtimeProviderManager.php           # 工厂（config('voice.provider')）
  Providers/QwenOmniProvider.php        # 百炼实现（豆包/OpenAI 照此扩展）
app/Services/
  VisitorService.php             # 免注册访客（匿名 Cookie）
  VoiceSessionService.php        # 会话编排/分片追加写/回合/PCM→WAV 封存
app/Http/Controllers/Api/Voice/  # visitors/scenarios/sessions(音频分片/回合/结束)
app/Http/Middleware/             # ResolveVisitor + VoiceQuota
resources/js/
  lib/audio/                     # recorder(AudioWorklet)/player/VAD/分片上传器
  lib/providers/qwenOmniClient.ts# 客户端协议适配（与后端保持一致）
  composables/useVoiceChat.ts    # 状态机：聆听⇄思考⇄说话 + 打断 + 录音
  Pages/VoiceChat.vue            # 对话页；Pages/Admin/ 管理端
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/voice/visitors` | 访客登记（可选 nickname/grade），下发匿名 Cookie |
| GET | `/api/voice/scenarios` | 场景列表 |
| POST | `/api/voice/sessions` | 开始会话，返回 `{ws_url, token, system_prompt, ...}` |
| POST | `/api/voice/sessions/{id}/audio/{student\|ai}?seq=N` | 录音分片追加（octet-stream，seq 幂等） |
| POST | `/api/voice/sessions/{id}/turns` | 字幕/回合批量落库 |
| POST | `/api/voice/sessions/{id}/reissue` | 断线重连：重签直连凭据（token 短时效） |
| POST | `/api/voice/sessions/{id}/end` | 结束：PCM→WAV 封存 + timeline + 配额累计 |

录音存储：`storage/app/private/voice/{session_id}/` 下 `student.wav`（16kHz）、`ai.wav`（24kHz）、`timeline.json`。

滞留会话收尾：`php artisan voice:close-stale-sessions`（已挂调度器每小时执行），
管理端会话列表对 active 会话也有「强制结束」按钮。

## 已知事项

- 阶段一为「浏览器直连供应商」模式；音频帧不走 Laravel/Reverb，网关抽象已预留中继位。
- 打断（barge-in）：本地能量 VAD 检测学生开口 → `response.cancel` + 播放队列 flush。
- 录音在浏览器侧分片上传（每 ~20s），标签页崩溃最多丢失最后一个间隔。
- `laravel/pint` 因 GitHub 下载超时从 require-dev 移除，需要时 `composer require laravel/pint --dev` 补回。
