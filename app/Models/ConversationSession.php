<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConversationSession extends Model
{
    use HasFactory;

    public const STATUS_CONNECTING = 'connecting';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_ENDED = 'ended';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'visitor_id',
        'user_id',
        'scenario_id',
        'provider',
        'language',
        'status',
        'duration_s',
        'turn_count',
        'input_text_tokens',
        'input_audio_tokens',
        'output_text_tokens',
        'output_audio_tokens',
        'cost_micro',
        'started_at',
        'ended_at',
        'student_audio_path',
        'ai_audio_path',
        'timeline_path',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function visitor(): BelongsTo
    {
        return $this->belongsTo(Visitor::class);
    }

    public function scenario(): BelongsTo
    {
        return $this->belongsTo(Scenario::class);
    }

    public function turns(): HasMany
    {
        return $this->hasMany(ConversationTurn::class, 'session_id')->orderBy('seq');
    }
}
