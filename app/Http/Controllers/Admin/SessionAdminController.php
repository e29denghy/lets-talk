<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConversationSession;
use App\Models\Visitor;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * 内部管理端（auth.basic 保护）：访客/会话记录 + 双轨回放。
 */
class SessionAdminController extends Controller
{
    public function index(): Response
    {
        $sessions = ConversationSession::with(['visitor:id,uuid,nickname,grade', 'scenario:id,name,level'])
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (ConversationSession $session) => [
                'id' => $session->id,
                'visitor' => $session->visitor?->nickname ?: ($session->visitor ? substr($session->visitor->uuid, 0, 8) : '未知'),
                'grade' => $session->visitor?->grade,
                'scenario' => $session->scenario?->name ?? '未选场景',
                'provider' => $session->provider,
                'status' => $session->status,
                'duration_s' => $session->duration_s,
                'turn_count' => $session->turn_count,
                'started_at' => $session->started_at?->toDateTimeString(),
            ]);

        return Inertia::render('Admin/SessionsIndex', ['sessions' => $sessions]);
    }

    public function visitors(): Response
    {
        $visitors = Visitor::query()
            ->withSum([
                'quotas as used_today_s' => fn ($query) => $query->where('date', today()->toDateString()),
            ], 'used_seconds')
            ->latest('last_seen_at')
            ->limit(100)
            ->get()
            ->map(fn (Visitor $visitor) => [
                'id' => $visitor->id,
                'uuid' => substr($visitor->uuid, 0, 8),
                'nickname' => $visitor->nickname,
                'grade' => $visitor->grade,
                'sessions_count' => $visitor->sessions_count,
                'used_today_s' => (int) ($visitor->used_today_s ?? 0),
                'first_seen_at' => $visitor->first_seen_at?->toDateTimeString(),
                'last_seen_at' => $visitor->last_seen_at?->toDateTimeString(),
            ]);

        return Inertia::render('Admin/VisitorsIndex', ['visitors' => $visitors]);
    }

    public function show(ConversationSession $session): Response
    {
        $turns = $session->turns()->get()->map(fn ($turn) => [
            'seq' => $turn->seq,
            'speaker' => $turn->speaker,
            'text' => $turn->text,
            'latency_ms' => $turn->latency_ms,
        ]);

        return Inertia::render('Admin/SessionDetail', [
            'session' => [
                'id' => $session->id,
                'visitor' => $session->visitor?->nickname ?: ($session->visitor ? substr($session->visitor->uuid, 0, 8) : '未知'),
                'grade' => $session->visitor?->grade,
                'scenario' => $session->scenario?->name ?? '未选场景',
                'provider' => $session->provider,
                'status' => $session->status,
                'duration_s' => $session->duration_s,
                'turn_count' => $session->turn_count,
                'started_at' => $session->started_at?->toDateTimeString(),
                'ended_at' => $session->ended_at?->toDateTimeString(),
                'audio_urls' => [
                    'student' => $session->student_audio_path
                        ? route('admin.sessions.audio', [$session, 'channel' => 'student'])
                        : null,
                    'ai' => $session->ai_audio_path
                        ? route('admin.sessions.audio', [$session, 'channel' => 'ai'])
                        : null,
                ],
            ],
            'turns' => $turns,
        ]);
    }

    public function audio(ConversationSession $session, string $channel): StreamedResponse|JsonResponse
    {
        $path = match ($channel) {
            'student' => $session->student_audio_path,
            'ai' => $session->ai_audio_path,
            default => null,
        };

        abort_if(! $path || ! Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, basename($path), ['Content-Type' => 'audio/wav']);
    }
}
