<?php

namespace App\Http\Controllers\Api\Voice;

use App\Http\Controllers\Controller;
use App\Models\Scenario;
use App\Models\VoiceQuota;
use Illuminate\Http\JsonResponse;

class ScenarioController extends Controller
{
    public function index(): JsonResponse
    {
        $scenarios = Scenario::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'slug', 'emoji', 'color', 'level', 'description', 'target_vocab', 'unit_text'])
            ->map(fn (Scenario $scenario) => [
                'id' => $scenario->id,
                'name' => $scenario->name,
                'slug' => $scenario->slug,
                'emoji' => $scenario->emoji,
                'color' => $scenario->color,
                'level' => $scenario->level,
                'description' => $scenario->description,
                'target_vocab' => $scenario->target_vocab ?? [],
                'unit_text' => $scenario->unit_text,
            ]);

        // 首页需要展示今日配额（访客由 ResolveVisitor 中间件注入）
        $used = (int) (VoiceQuota::where('visitor_id', app('voice.visitor')->id)
            ->where('date', today()->toDateString())
            ->value('used_seconds') ?? 0);

        return response()->json([
            'scenarios' => $scenarios,
            'quota' => [
                'used_seconds' => $used,
                'limit_seconds' => (int) config('voice.quota.daily_seconds', 3600),
            ],
        ]);
    }
}
