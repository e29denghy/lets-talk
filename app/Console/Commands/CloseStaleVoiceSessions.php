<?php

namespace App\Console\Commands;

use App\Models\ConversationSession;
use App\Services\VoiceSessionService;
use Illuminate\Console\Command;

/**
 * 结束滞留的语音会话。
 *
 * 浏览器被直接关闭/网络长时间断开时，会话会停留在 active 状态，
 * 该命令负责收尾：封存已上传录音、统计时长、累计配额。
 * 建议配合调度器定期执行（内部使用也可手动跑）。
 */
class CloseStaleVoiceSessions extends Command
{
    protected $signature = 'voice:close-stale-sessions {--hours=2 : 开始时间早于多少小时的会话视为滞留}';

    protected $description = '结束滞留的语音会话（封存录音、累计配额）';

    public function handle(VoiceSessionService $sessions): int
    {
        $hours = max(0, (int) $this->option('hours'));

        $stale = ConversationSession::query()
            ->where('status', ConversationSession::STATUS_ACTIVE)
            ->where('started_at', '<', now()->subHours($hours))
            ->get();

        foreach ($stale as $session) {
            $sessions->end($session, []);
            $this->line("已结束滞留会话 #{$session->id}（{$session->duration_s}s）。");
        }

        $this->info("共结束 {$stale->count()} 个滞留会话。");

        return self::SUCCESS;
    }
}
