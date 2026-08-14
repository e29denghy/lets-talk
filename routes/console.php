<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// 每小时收尾滞留的语音会话（浏览器直接关闭等场景）
Schedule::command('voice:close-stale-sessions')->hourly();
