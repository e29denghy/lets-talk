<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoiceAudioChunk extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'channel',
        'seq',
        'size',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ConversationSession::class, 'session_id');
    }
}
