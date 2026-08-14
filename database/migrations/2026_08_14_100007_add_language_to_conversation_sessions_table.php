<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversation_sessions', function (Blueprint $table) {
            $table->string('language', 8)->default('en')->after('provider')->comment('对话语言 en|zh');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_sessions', function (Blueprint $table) {
            $table->dropColumn('language');
        });
    }
};
