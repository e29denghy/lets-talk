<?php

use App\Http\Controllers\Api\Voice\ScenarioController;
use App\Http\Controllers\Api\Voice\SessionController;
use App\Http\Controllers\Api\Voice\VisitorController;
use App\Http\Middleware\ResolveVisitor;
use App\Http\Middleware\VoiceQuota;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Let's Talk 语音会话 API
|--------------------------------------------------------------------------
| 免注册访客体系：首次 POST /voice/visitors 下发匿名 Cookie，
| 其余接口凭 Cookie 识别访客（ResolveVisitor 中间件）。
*/

Route::post('/voice/visitors', [VisitorController::class, 'store']);

Route::middleware(ResolveVisitor::class)->prefix('voice')->group(function () {
    Route::get('/scenarios', [ScenarioController::class, 'index']);

    Route::post('/sessions', [SessionController::class, 'store'])
        ->middleware(VoiceQuota::class);

    Route::post('/sessions/{session}/audio/{channel}', [SessionController::class, 'appendAudio'])
        ->whereIn('channel', ['student', 'ai']);

    Route::post('/sessions/{session}/turns', [SessionController::class, 'storeTurns']);

    Route::post('/sessions/{session}/reissue', [SessionController::class, 'reissue']);

    Route::post('/sessions/{session}/end', [SessionController::class, 'end']);
});
