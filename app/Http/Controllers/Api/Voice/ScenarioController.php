<?php

namespace App\Http\Controllers\Api\Voice;

use App\Http\Controllers\Controller;
use App\Models\Scenario;
use Illuminate\Http\JsonResponse;

class ScenarioController extends Controller
{
    public function index(): JsonResponse
    {
        $scenarios = Scenario::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'slug', 'level', 'description', 'target_vocab'])
            ->map(fn (Scenario $scenario) => [
                'id' => $scenario->id,
                'name' => $scenario->name,
                'slug' => $scenario->slug,
                'level' => $scenario->level,
                'description' => $scenario->description,
                'target_vocab' => $scenario->target_vocab ?? [],
            ]);

        return response()->json(['scenarios' => $scenarios]);
    }
}
