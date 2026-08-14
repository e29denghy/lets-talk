<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 回合级 token 用量与费用（来自 response.done 的 usage）
        Schema::table('conversation_turns', function (Blueprint $table) {
            $table->unsignedInteger('input_text_tokens')->nullable()->after('latency_ms');
            $table->unsignedInteger('input_audio_tokens')->nullable()->after('input_text_tokens');
            $table->unsignedInteger('output_text_tokens')->nullable()->after('input_audio_tokens');
            $table->unsignedInteger('output_audio_tokens')->nullable()->after('output_text_tokens');
            $table->unsignedBigInteger('cost_micro')->nullable()->after('output_audio_tokens')->comment('费用（百万分之一元人民币）');
        });

        // 会话级汇总
        Schema::table('conversation_sessions', function (Blueprint $table) {
            $table->unsignedInteger('input_text_tokens')->default(0)->after('turn_count');
            $table->unsignedInteger('input_audio_tokens')->default(0)->after('input_text_tokens');
            $table->unsignedInteger('output_text_tokens')->default(0)->after('input_audio_tokens');
            $table->unsignedInteger('output_audio_tokens')->default(0)->after('output_text_tokens');
            $table->unsignedBigInteger('cost_micro')->default(0)->after('output_audio_tokens')->comment('费用（百万分之一元人民币）');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_turns', function (Blueprint $table) {
            $table->dropColumn(['input_text_tokens', 'input_audio_tokens', 'output_text_tokens', 'output_audio_tokens', 'cost_micro']);
        });

        Schema::table('conversation_sessions', function (Blueprint $table) {
            $table->dropColumn(['input_text_tokens', 'input_audio_tokens', 'output_text_tokens', 'output_audio_tokens', 'cost_micro']);
        });
    }
};
