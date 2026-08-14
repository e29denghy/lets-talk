<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Scenario;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 场景卡片管理（内部管理端）：可视化增删改，无需改代码/数据库。
 */
class ScenarioAdminController extends Controller
{
    public function index(): Response
    {
        $scenarios = Scenario::query()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Scenario $scenario) => [
                'id' => $scenario->id,
                'name' => $scenario->name,
                'slug' => $scenario->slug,
                'level' => $scenario->level,
                'description' => $scenario->description,
                'system_prompt' => $scenario->system_prompt,
                'target_vocab' => implode(', ', $scenario->target_vocab ?? []),
                'voice_config' => $scenario->voice_config === []
                    ? ''
                    : json_encode($scenario->voice_config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
                'sort_order' => $scenario->sort_order,
                'is_active' => (bool) $scenario->is_active,
            ]);

        return Inertia::render('Admin/ScenariosIndex', ['scenarios' => $scenarios]);
    }

    public function store(Request $request): RedirectResponse
    {
        Scenario::create($this->validated($request));

        return back();
    }

    public function update(Request $request, Scenario $scenario): RedirectResponse
    {
        $scenario->update($this->validated($request, $scenario));

        return back();
    }

    public function destroy(Scenario $scenario): RedirectResponse
    {
        $scenario->delete();

        return back();
    }

    private function validated(Request $request, ?Scenario $scenario = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['required', 'string', 'max:100', 'alpha_dash', Rule::unique('scenarios', 'slug')->ignore($scenario?->id)],
            'level' => ['required', 'integer', 'between:1,3'],
            'description' => ['nullable', 'string', 'max:255'],
            'system_prompt' => ['required', 'string'],
            'target_vocab' => ['nullable', 'string'],
            'voice_config' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        // 逗号分隔的词汇 → 数组
        $data['target_vocab'] = collect(explode(',', (string) ($data['target_vocab'] ?? '')))
            ->map(fn ($word) => trim($word))
            ->filter()
            ->values()
            ->all();

        // 自由格式 JSON → 数组（解析失败则空）
        $voice = json_decode((string) ($data['voice_config'] ?? ''), true);
        $data['voice_config'] = is_array($voice) ? $voice : [];

        $data['is_active'] = (bool) ($data['is_active'] ?? false);
        $data['sort_order'] = (int) ($data['sort_order'] ?? 0);

        return $data;
    }
}
