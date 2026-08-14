<?php

namespace App\Services;

use App\Models\Visitor;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * 免注册访客体系：签名 Cookie（uuid v4 即不可猜测的匿名 ID）+ visitors 表记录。
 */
class VisitorService
{
    public const COOKIE_NAME = 'lets_talk_visitor';

    public const COOKIE_LIFETIME_MINUTES = 60 * 24 * 365; // 1 年

    public function register(?string $nickname, ?int $grade, Request $request): Visitor
    {
        return Visitor::create([
            'uuid' => (string) Str::uuid(),
            'nickname' => $nickname,
            'grade' => $grade,
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 512),
            'first_seen_at' => now(),
            'last_seen_at' => now(),
        ]);
    }

    public function resolveFromRequest(Request $request): ?Visitor
    {
        $uuid = $request->cookie(self::COOKIE_NAME);

        if (! is_string($uuid) || ! Str::isUuid($uuid)) {
            return null;
        }

        return Visitor::where('uuid', $uuid)->first();
    }

    public function touchActivity(Visitor $visitor, Request $request): void
    {
        $visitor->update([
            'last_seen_at' => now(),
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 512),
        ]);
    }

    public function makeCookie(string $uuid): \Symfony\Component\HttpFoundation\Cookie
    {
        return \Illuminate\Support\Facades\Cookie::make(
            self::COOKIE_NAME,
            $uuid,
            self::COOKIE_LIFETIME_MINUTES,
            '/',
            null,
            request()->isSecure(),
            true, // httpOnly
            false,
            'Lax',
        );
    }
}
