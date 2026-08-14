<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Visitor extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'nickname',
        'grade',
        'ip',
        'user_agent',
        'first_seen_at',
        'last_seen_at',
        'sessions_count',
    ];

    protected function casts(): array
    {
        return [
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ConversationSession::class);
    }

    public function quotas(): HasMany
    {
        return $this->hasMany(VoiceQuota::class);
    }
}
