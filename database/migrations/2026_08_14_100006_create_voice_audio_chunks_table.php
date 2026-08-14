<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voice_audio_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('conversation_sessions')->cascadeOnDelete();
            $table->enum('channel', ['student', 'ai']);
            $table->unsignedBigInteger('seq');
            $table->unsignedInteger('size');
            $table->timestamps();

            // 幂等：同一会话同一通道同一序号只接受一次
            $table->unique(['session_id', 'channel', 'seq']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voice_audio_chunks');
    }
};
