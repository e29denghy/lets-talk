<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api, ApiError, type Scenario } from '../lib/api';
import { useVoiceChat } from '../composables/useVoiceChat';
import WelcomeHeader from '../Components/voice/WelcomeHeader.vue';
import VisitorOnboarding from '../Components/voice/VisitorOnboarding.vue';
import ScenarioGallery from '../Components/voice/ScenarioGallery.vue';
import SessionTopBar from '../Components/voice/SessionTopBar.vue';
import ChatStage from '../Components/voice/ChatStage.vue';
import SubtitleConsole from '../Components/voice/SubtitleConsole.vue';
import ChatControls from '../Components/voice/ChatControls.vue';
import SessionEndCard from '../Components/voice/SessionEndCard.vue';

const { state, start, stop, interrupt, dismiss } = useVoiceChat();

const NICKNAME_KEY = 'lets_talk_nickname';

const loading = ref(true);
const needRegister = ref(false);
const homeError = ref<string | null>(null);
const scenarios = ref<Scenario[]>([]);
const activeScenarioId = ref<number | null>(null);
const activeScenario = ref<Scenario | null>(null);
const language = ref<'en' | 'zh'>('en');
// 首页配额（会话开始后 state.quota 也会更新）
const homeQuota = ref<{ used_seconds: number; limit_seconds: number } | null>(null);

// 昵称本地记忆（仅用于问候展示；访客身份仍以后端签名 Cookie 为准）
const nickname = ref<string | null>(localStorage.getItem(NICKNAME_KEY));
const form = reactive({ nickname: '', grade: null as number | null });

const isInSession = computed(() =>
    ['connecting', 'listening', 'thinking', 'speaking'].includes(state.status),
);

/**
 * 三屏：onboarding 首访登记 → home 场景画廊 → session 会话舞台 → ended 结束反馈。
 * 会话建立失败（sessionId 为空）时留在 home 屏并显示错误横幅。
 */
const screen = computed(() => {
    if (needRegister.value) return 'onboarding';
    if (isInSession.value || (state.status === 'error' && state.sessionId !== null)) return 'session';
    if (state.status === 'ended') return 'ended';
    return 'home';
});

const studentTurns = computed(
    () => state.subtitles.filter((s) => s.speaker === 'student').length,
);

async function loadScenarios(): Promise<void> {
    loading.value = true;
    homeError.value = null;

    try {
        const data = await api.scenarios();
        scenarios.value = data.scenarios;
        homeQuota.value = data.quota ?? null;
        needRegister.value = false;
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            needRegister.value = true;
        } else {
            homeError.value = error instanceof Error ? error.message : String(error);
        }
    } finally {
        loading.value = false;
    }
}

async function register(): Promise<void> {
    homeError.value = null;

    try {
        await api.registerVisitor({
            nickname: form.nickname.trim() || undefined,
            grade: form.grade ?? undefined,
        });

        if (form.nickname.trim()) {
            nickname.value = form.nickname.trim();
            localStorage.setItem(NICKNAME_KEY, nickname.value);
        }

        needRegister.value = false;
        await loadScenarios();
    } catch (error) {
        homeError.value = error instanceof Error ? error.message : String(error);
    }
}

async function onStart(scenario: Scenario): Promise<void> {
    activeScenarioId.value = scenario.id;
    activeScenario.value = scenario;
    homeError.value = null;

    try {
        await start(
            scenario.id,
            language.value,
            nickname.value ?? undefined,
            form.grade ?? undefined,
        );
    } catch {
        // 错误已在 state.error 中，home 屏会显示横幅
    }
}

async function onStop(): Promise<void> {
    await stop();
    // 结束后的配额回写首页展示
    if (state.quota) homeQuota.value = state.quota;
}

function onDismiss(): void {
    void dismiss();
}

onMounted(loadScenarios);
</script>

<template>
    <div class="relative min-h-screen overflow-hidden bg-cream-100 font-sans text-ink-700 antialiased">
        <!-- 漂浮装饰（纯氛围，屏幕阅读器忽略） -->
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <span class="animate-float absolute -left-6 top-20 text-6xl opacity-40">☁️</span>
            <span class="animate-float absolute right-8 top-36 text-5xl opacity-40" style="animation-delay: 1.2s">⭐</span>
            <span class="animate-float absolute bottom-24 left-8 text-5xl opacity-30" style="animation-delay: 2s">🎈</span>
            <span class="animate-float absolute -right-3 bottom-10 text-6xl opacity-30" style="animation-delay: 0.6s">🌈</span>
        </div>

        <div class="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:py-6">
            <!-- ═══ 屏 A：首页（问候 + 登记/画廊） ═══ -->
            <template v-if="screen === 'home' || screen === 'onboarding'">
                <WelcomeHeader
                    :nickname="nickname"
                    :language="language"
                    :quota="homeQuota ?? state.quota"
                    @update-language="language = $event"
                />

                <VisitorOnboarding v-if="screen === 'onboarding'" :error="homeError" @submit="register" />
                <ScenarioGallery
                    v-else
                    :scenarios="scenarios"
                    :loading="loading"
                    :error="homeError"
                    :active-id="activeScenarioId"
                    @select="onStart"
                />

                <!-- 会话建立失败 / 配额超限等错误横幅 -->
                <div
                    v-if="state.error && screen === 'home'"
                    class="animate-fade-up mx-auto mt-6 flex max-w-xl items-center justify-between gap-4 rounded-2xl border-2 border-coral-200 bg-coral-100 px-5 py-4"
                    role="alert"
                >
                    <p class="text-sm font-bold text-coral-700">⚠️ {{ state.error }}</p>
                    <button
                        type="button"
                        class="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-coral-600 shadow-soft transition active:scale-95"
                        @click="onDismiss"
                    >
                        知道了
                    </button>
                </div>
            </template>

            <!-- ═══ 屏 B：会话舞台 ═══ -->
            <template v-else-if="screen === 'session'">
                <SessionTopBar
                    :scenario="activeScenario"
                    :duration-s="state.durationS"
                    :quota="state.quota"
                    :status="state.status"
                    @end="onStop"
                />

                <div class="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                    <ChatStage
                        :status="state.status"
                        :mic-level="state.micLevel"
                        :duration-s="state.durationS"
                        :error="state.error"
                    />

                    <div class="flex h-[45vh] min-h-0 lg:h-[calc(100vh-16rem)]">
                        <SubtitleConsole
                            :subtitles="state.subtitles"
                            :status="state.status"
                            :unit-text="activeScenario?.unit_text ?? null"
                        />
                    </div>
                </div>

                <div class="mt-4">
                    <ChatControls
                        v-if="isInSession"
                        :status="state.status"
                        @interrupt="interrupt"
                        @stop="onStop"
                    />

                    <!-- 会话中失败：语音连接断开等 -->
                    <div
                        v-else-if="state.status === 'error'"
                        class="flex flex-col items-center gap-3 rounded-[2rem] bg-white px-6 py-5 shadow-soft"
                        role="alert"
                    >
                        <p class="text-center text-sm font-bold text-coral-600">
                            ⚠️ {{ state.error ?? '出错了' }}
                        </p>
                        <button
                            type="button"
                            class="rounded-full bg-ink-700 px-6 py-2.5 text-sm font-extrabold text-white transition hover:bg-ink-600 active:scale-95"
                            @click="onDismiss"
                        >
                            返回重新开始
                        </button>
                    </div>
                </div>
            </template>

            <!-- ═══ 屏 C：结束反馈 ═══ -->
            <template v-else>
                <div class="flex flex-1 items-center justify-center py-4">
                    <SessionEndCard
                        :scenario="activeScenario"
                        :duration-s="state.durationS"
                        :student-turns="studentTurns"
                        :sentence-count="state.subtitles.length"
                        :quota="state.quota"
                        @again="activeScenario ? onStart(activeScenario) : onDismiss()"
                        @home="onDismiss"
                    />
                </div>
            </template>

            <footer class="mt-6 pb-2 text-center text-xs font-semibold text-ink-300">
                录音仅用于内部学习回听 · 请使用 Chrome / Edge / Safari 最新版本
            </footer>
        </div>
    </div>
</template>
