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
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ConversationSession::class, 'session_id');
    }
}
