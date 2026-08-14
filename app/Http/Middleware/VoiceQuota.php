<?php

namespace App\Http\Middleware;

use App\Models\VoiceQuota as VoiceQuotaModel;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 访客每日语音时长配额（挂在「开始会话」接口上）。
 */
class VoiceQuota
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var \App\Models\Visitor $visitor */
        $visitor = app('voice.visitor');

        $used = (int) (VoiceQuotaModel::where('visitor_id', $visitor->id)
            ->where('date', today()->toDateString())
            ->value('used_seconds') ?? 0);

        $limit = (int) config('voice.quota.daily_seconds', 3600);

        if ($used >= $limit) {
            return response()->json([
                'message' => '今日练习时长已达上限，明天再来吧！',
                'used_seconds' => $used,
                'limit_seconds' => $limit,
            ], 429);
        }

        return $next($request);
    }
}
