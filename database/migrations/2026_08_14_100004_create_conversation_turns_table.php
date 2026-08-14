<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_turns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('conversation_sessions')->cascadeOnDelete();
            $table->unsignedInteger('seq');
            $table->enum('speaker', ['student', 'assistant']);
            $table->text('text');
            $table->unsignedInteger('start_ms')->nullable();
            $table->unsignedInteger('end_ms')->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->timestamps();

            $table->unique(['session_id', 'seq']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_turns');
    }
};
