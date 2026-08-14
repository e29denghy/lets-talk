<?php

namespace App\Http\Controllers\Api\Voice;

use App\Http\Controllers\Controller;
use App\Services\VisitorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitorController extends Controller
{
    public function __construct(private VisitorService $visitors)
    {
    }

    /** 免注册访客登记：建记录 + 下发匿名 Cookie。 */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nickname' => ['nullable', 'string', 'max:50'],
            'grade' => ['nullable', 'integer', 'between:1,6'],
        ]);

        $visitor = $this->visitors->register(
            $data['nickname'] ?? null,
            $data['grade'] ?? null,
            $request,
        );

        return response()
            ->json([
                'visitor' => [
                    'uuid' => $visitor->uuid,
                    'nickname' => $visitor->nickname,
                    'grade' => $visitor->grade,
                ],
            ], 201)
            ->withCookie($this->visitors->makeCookie($visitor->uuid));
    }
}
