<?php

use App\Http\Controllers\Admin\SessionAdminController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', fn () => Inertia::render('VoiceChat'))->name('home');

// 内部管理端（auth.basic：浏览器弹窗登录，账号见 seeder 的 admin@example.com）
Route::middleware('auth.basic')->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [SessionAdminController::class, 'index'])->name('sessions.index');
    Route::get('/visitors', [SessionAdminController::class, 'visitors'])->name('visitors.index');
    Route::get('/sessions/{session}', [SessionAdminController::class, 'show'])->name('sessions.show');
    Route::get('/sessions/{session}/audio/{channel}', [SessionAdminController::class, 'audio'])
        ->whereIn('channel', ['student', 'ai'])
        ->name('sessions.audio');
});
