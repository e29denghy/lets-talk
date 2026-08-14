<?php

namespace App\Http\Middleware;

use App\Services\VisitorService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 解析签名 Cookie 中的访客身份，绑定到容器实例 'voice.visitor'。
 */
class ResolveVisitor
{
    public function handle(Request $request, Closure $next): Response
    {
        $visitor = app(VisitorService::class)->resolveFromRequest($request);

        if (! $visitor) {
            return response()->json(['message' => '请先完成访客登记。'], 401);
        }

        app()->instance('voice.visitor', $visitor);

        return $next($request);
    }
}
