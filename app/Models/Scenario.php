<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Scenario extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'level',
        'description',
        'system_prompt',
        'unit_text',
        'target_vocab',
        'voice_config',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'target_vocab' => 'array',
            'voice_config' => 'array',
            'is_active' => 'bool',
        ];
    }
}
