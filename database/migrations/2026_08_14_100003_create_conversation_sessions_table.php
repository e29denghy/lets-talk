<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visitor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete()->comment('将来接账号体系');
            $table->foreignId('scenario_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 32)->default('qwen_omni');
            $table->string('status', 16)->default('active')->comment('connecting|active|ended|failed');
            $table->unsignedInteger('duration_s')->default(0);
            $table->unsignedInteger('turn_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->string('student_audio_path')->nullable();
            $table->string('ai_audio_path')->nullable();
            $table->string('timeline_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_sessions');
    }
};
