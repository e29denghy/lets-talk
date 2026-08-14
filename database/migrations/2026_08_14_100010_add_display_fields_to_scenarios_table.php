<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scenarios', function (Blueprint $table) {
            $table->string('emoji', 16)->nullable()->after('name')->comment('场景插图 emoji');
            $table->string('color', 20)->nullable()->after('emoji')->comment('主题色: sun|coral|mint|azure|grape');
        });
    }

    public function down(): void
    {
        Schema::table('scenarios', function (Blueprint $table) {
            $table->dropColumn(['emoji', 'color']);
        });
    }
};
