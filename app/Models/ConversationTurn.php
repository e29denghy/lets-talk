<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationTurn extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'seq',
        'speaker',
        'text',
        'start_ms',
        'end_ms',
        'latency_ms',
        'input_text_tokens',
        'input_audio_tokens',
        'output_text_tokens',
        'output_audio_tokens',
        'cost_micro',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ConversationSession::class, 'session_id');
    }
}
