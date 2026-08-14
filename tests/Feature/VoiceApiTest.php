<?php

namespace Tests\Feature;

use App\Models\ConversationSession;
use App\Models\Scenario;
use App\Models\User;
use App\Models\VoiceQuota;
use Database\Seeders\ScenarioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Support\FakeVoiceProvider;
use Tests\TestCase;

class VoiceApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // JSON 请求默认不带 Cookie，本项目靠匿名 Cookie 识别访客，需显式开启
        $this->withCredentials();

        config()->set('voice.provider', 'fake');
        config()->set('voice.providers.fake.driver', FakeVoiceProvider::class);

        $this->seed(ScenarioSeeder::class);
    }

    protected function registerVisitor(string $nickname = '小明', int $grade = 3)
    {
        $response = $this->postJson('/api/voice/visitors', [
            'nickname' => $nickname,
            'grade' => $grade,
        ]);

        // 测试客户端不会自动回传响应 Cookie，手动把访客 Cookie 带入后续请求
        $cookie = $response->getCookie('lets_talk_visitor', false);

        if ($cookie) {
            $this->withUnencryptedCookies(['lets_talk_visitor' => $cookie->getValue()]);
        }

        return $response;
    }

    protected function beginSession(int $scenarioId): int
    {
        return $this->postJson('/api/voice/sessions', ['scenario_id' => $scenarioId])
            ->assertCreated()
            ->json('session.id');
    }

    /** 原始字节上传（application/octet-stream，seq 走 query）。 */
    protected function postRawAudio(int $sessionId, string $channel, int $seq, string $bytes)
    {
        return $this->call(
            'POST',
            "/api/voice/sessions/{$sessionId}/audio/{$channel}?seq={$seq}",
            [],
            $this->prepareCookiesForRequest(),
            [],
            $this->transformHeadersToServerVars(['CONTENT_TYPE' => 'application/octet-stream']),
            $bytes,
        );
    }

    public function test_scenarios_requires_visitor_cookie(): void
    {
        $this->getJson('/api/voice/scenarios')->assertStatus(401);
    }

    public function test_visitor_can_register_and_list_scenarios(): void
    {
        $this->registerVisitor()
            ->assertStatus(201)
            ->assertCookie('lets_talk_visitor')
            ->assertJsonPath('visitor.nickname', '小明');

        $this->getJson('/api/voice/scenarios')
            ->assertOk()
            ->assertJsonCount(4, 'scenarios');
    }

    public function test_visitor_grade_is_validated(): void
    {
        $this->postJson('/api/voice/visitors', ['grade' => 7])
            ->assertStatus(422);
    }

    public function test_start_session_returns_provider_credentials(): void
    {
        $this->registerVisitor();

        $scenario = Scenario::where('slug', 'greetings')->firstOrFail();

        $this->postJson('/api/voice/sessions', ['scenario_id' => $scenario->id])
            ->assertCreated()
            ->assertJsonPath('credentials.provider', 'fake')
            ->assertJsonPath('credentials.ws_url', 'wss://fake.example.test/realtime?token=test')
            ->assertJsonPath('credentials.session_init.type', 'session.update')
            ->assertJsonStructure(['system_prompt', 'audio', 'quota'])
            ->assertJsonPath('session.status', 'active');
    }

    public function test_full_session_flow_records_audio_turns_and_quota(): void
    {
        Storage::fake('local');

        $this->registerVisitor();

        $scenario = Scenario::where('slug', 'zoo')->firstOrFail();
        $sessionId = $this->beginSession($scenario->id);

        // 让会话产生真实时长（否则同秒结束 duration=0，配额不累计）
        ConversationSession::where('id', $sessionId)
            ->update(['started_at' => now()->subSeconds(42)]);

        // 学生分片 + seq 幂等去重
        $this->postRawAudio($sessionId, 'student', 0, 'PCMDATA-000')
            ->assertOk()->assertJson(['stored' => true, 'duplicate' => false]);

        $this->postRawAudio($sessionId, 'student', 0, 'PCMDATA-000')
            ->assertOk()->assertJson(['duplicate' => true]);

        // AI 分片
        $this->postRawAudio($sessionId, 'ai', 0, 'AIDATA-000')
            ->assertOk()->assertJson(['stored' => true]);

        // 回合落库
        $this->postJson('/api/voice/sessions/'.$sessionId.'/turns', [
            'turns' => [
                ['seq' => 1, 'speaker' => 'student', 'text' => 'Hello!'],
                ['seq' => 2, 'speaker' => 'assistant', 'text' => 'Hi there!'],
            ],
        ])->assertOk()->assertJson(['stored' => 2]);

        // 结束：封存 + 配额累计
        $this->postJson('/api/voice/sessions/'.$sessionId.'/end', ['timeline' => []])
            ->assertOk()
            ->assertJsonPath('session.status', 'ended')
            ->assertJsonPath('session.turn_count', 2);

        $session = ConversationSession::findOrFail($sessionId);
        $this->assertNotNull($session->student_audio_path);
        Storage::disk('local')->assertExists($session->student_audio_path);
        Storage::disk('local')->assertExists($session->ai_audio_path);

        $this->assertDatabaseHas('voice_quotas', [
            'visitor_id' => 1,
            'date' => today()->toDateString(),
        ]);
    }

    public function test_quota_blocks_new_session_when_daily_limit_reached(): void
    {
        $this->registerVisitor();

        VoiceQuota::create([
            'visitor_id' => 1,
            'date' => today()->toDateString(),
            'used_seconds' => 99999,
        ]);

        $scenario = Scenario::firstOrFail();

        $this->postJson('/api/voice/sessions', ['scenario_id' => $scenario->id])
            ->assertStatus(429);
    }

    public function test_visitor_cannot_touch_another_visitors_session(): void
    {
        Storage::fake('local');

        $this->registerVisitor('小明', 3);
        $sessionId = $this->beginSession(Scenario::firstOrFail()->id);

        // 第二个访客（新 Cookie）
        $this->registerVisitor('小红', 2);

        $this->postRawAudio($sessionId, 'student', 0, 'X')->assertStatus(403);
    }

    public function test_admin_can_download_session_audio_with_basic_auth(): void
    {
        Storage::fake('local');

        $this->registerVisitor();

        User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
        ]);

        $sessionId = $this->beginSession(Scenario::firstOrFail()->id);

        $this->postRawAudio($sessionId, 'student', 0, 'PCMDATA-000')->assertOk();

        $this->postJson('/api/voice/sessions/'.$sessionId.'/end', ['timeline' => []]);

        $basic = 'Basic '.base64_encode('admin@example.com:password');

        $this->get('/admin/sessions/'.$sessionId.'/audio/student', [
            'Authorization' => $basic,
        ])->assertOk()->assertHeader('Content-Type', 'audio/wav');

        // auth.basic 成功后 guard 单例会缓存登录用户，登出后再验证未授权 401
        $this->app['auth']->guard('web')->logout();
        $this->flushSession();

        $this->get('/admin/sessions/'.$sessionId.'/audio/student')->assertStatus(401);
    }
}
