<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voice_quotas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visitor_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('used_seconds')->default(0);
            $table->timestamps();

            $table->unique(['visitor_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voice_quotas');
    }
};
