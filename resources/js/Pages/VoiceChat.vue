<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { api, ApiError, type Scenario } from '../lib/api';
import { useVoiceChat } from '../composables/useVoiceChat';

const { state, start, stop, interrupt, dismiss } = useVoiceChat();

const loading = ref(true);
const needRegister = ref(false);
const pageError = ref<string | null>(null);
const scenarios = ref<Scenario[]>([]);
const activeScenarioId = ref<number | null>(null);
const scrollBox = ref<HTMLElement | null>(null);
const language = ref<'en' | 'zh'>('en');

const form = reactive({ nickname: '', grade: null as number | null });

const statusText = computed(() => {
    const map: Record<string, string> = {
        idle: '准备开始',
        connecting: '正在连接语音服务…',
        listening: '我在听，请开口说英语吧',
        thinking: '让我想一想…',
        speaking: 'AI 正在说话（开口即可打断）',
        ended: '本次练习已结束',
        error: '出错了',
    };
    return map[state.status] ?? state.status;
});

const statusBadgeClass = computed(() => {
    const map: Record<string, string> = {
        idle: 'bg-slate-100 text-slate-600',
        connecting: 'bg-amber-100 text-amber-700',
        listening: 'bg-emerald-100 text-emerald-700',
        thinking: 'bg-indigo-100 text-indigo-700',
        speaking: 'bg-indigo-100 text-indigo-700',
        ended: 'bg-slate-200 text-slate-600',
        error: 'bg-red-100 text-red-700',
    };
    return map[state.status] ?? map.idle;
});

const avatarEmoji = computed(() => {
    switch (state.status) {
        case 'listening':
            return '🎧';
        case 'thinking':
            return '🤔';
        case 'speaking':
            return '🤖';
        case 'ended':
            return '⭐';
        case 'error':
            return '⚠️';
        default:
            return '🎙️';
    }
});

const avatarPulse = computed(
    () => state.status === 'listening' || state.status === 'speaking' || state.status === 'thinking',
);

const isInSession = computed(() =>
    ['connecting', 'listening', 'thinking', 'speaking'].includes(state.status),
);

const quotaPercent = computed(() => {
    if (!state.quota || state.quota.limit_seconds === 0) return 0;
    return Math.min(100, Math.round((state.quota.used_seconds / state.quota.limit_seconds) * 100));
});

function fmtDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

async function loadScenarios(): Promise<void> {
    loading.value = true;
    pageError.value = null;

    try {
        scenarios.value = (await api.scenarios()).scenarios;
        needRegister.value = false;
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            needRegister.value = true;
        } else {
            pageError.value = error instanceof Error ? error.message : String(error);
        }
    } finally {
        loading.value = false;
    }
}

async function register(): Promise<void> {
    pageError.value = null;

    try {
        await api.registerVisitor({
            nickname: form.nickname.trim() || undefined,
            grade: form.grade ?? undefined,
        });
        needRegister.value = false;
        await loadScenarios();
    } catch (error) {
        pageError.value = error instanceof Error ? error.message : String(error);
    }
}

async function onStart(scenario: Scenario): Promise<void> {
    activeScenarioId.value = scenario.id;
    pageError.value = null;

    try {
        await start(
            scenario.id,
            language.value,
            form.nickname.trim() || undefined,
            form.grade ?? undefined,
        );
        await scrollToBottom();
    } catch {
        // 错误已在 state.error 中
    }
}

async function onStop(): Promise<void> {
    await stop();
}

async function onAvatarTap(): Promise<void> {
    if (state.status === 'speaking' || state.status === 'thinking') {
        interrupt();
        return;
    }

    await nextTick();
}

watch(
    () => state.subtitles.length,
    () => void scrollToBottom(),
);

async function scrollToBottom(): Promise<void> {
    await nextTick();
    if (scrollBox.value) {
        scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
    }
}

onMounted(loadScenarios);
</script>

<template>
    <div class="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6">
        <!-- 顶栏 -->
        <header class="mb-6 flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-slate-800">
                    Let's Talk <span class="text-base font-normal text-slate-500">· 英语对话练习</span>
                </h1>
                <p class="mt-1 text-sm text-slate-500">选一个场景，开口和 AI 老师聊起来吧</p>
            </div>
            <div class="flex items-center gap-3">
                <!-- 对话语言切换 -->
                <div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                        class="rounded-lg px-3 py-1 text-xs font-medium transition"
                        :class="language === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'"
                        :disabled="isInSession"
                        title="英文对话模式"
                        @click="language = 'en'"
                    >
                        EN
                    </button>
                    <button
                        class="rounded-lg px-3 py-1 text-xs font-medium transition"
                        :class="language === 'zh' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'"
                        :disabled="isInSession"
                        title="中文对话模式"
                        @click="language = 'zh'"
                    >
                        中文
                    </button>
                </div>

                <div v-if="state.quota" class="text-right">
                    <p class="text-xs text-slate-500">今日已用</p>
                    <p class="text-sm font-semibold text-slate-700">
                        {{ fmtDuration(state.quota.used_seconds) }} / {{ fmtDuration(state.quota.limit_seconds) }}
                    </p>
                    <div class="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
                        <div
                            class="h-full rounded-full transition-all"
                            :class="quotaPercent >= 90 ? 'bg-red-400' : 'bg-emerald-400'"
                            :style="{ width: `${quotaPercent}%` }"
                        />
                    </div>
                </div>
            </div>
        </header>

        <!-- 首次访客登记 -->
        <section v-if="needRegister" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-lg font-semibold text-slate-800">第一次来？先认识一下</h2>
            <p class="mt-1 text-sm text-slate-500">不需要注册账号，昵称和年级可选填，方便 AI 老师按你的水平来聊。</p>

            <div class="mt-4 flex flex-wrap items-end gap-4">
                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">昵称（可选）</span>
                    <input
                        v-model="form.nickname"
                        type="text"
                        maxlength="50"
                        placeholder="例如：小明"
                        class="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    />
                </label>

                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">年级（可选）</span>
                    <select
                        v-model="form.grade"
                        class="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    >
                        <option :value="null">不选</option>
                        <option v-for="g in 6" :key="g" :value="g">{{ g }} 年级</option>
                    </select>
                </label>

                <button
                    class="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-600"
                    @click="register"
                >
                    开始练习
                </button>
            </div>

            <p v-if="pageError" class="mt-3 text-sm text-red-600">{{ pageError }}</p>
        </section>

        <!-- 场景选择 -->
        <section v-else-if="!isInSession && state.status !== 'ended'" class="mb-6">
            <div v-if="loading" class="text-center text-sm text-slate-400">加载场景中…</div>

            <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                    v-for="scenario in scenarios"
                    :key="scenario.id"
                    class="group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                    :class="activeScenarioId === scenario.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'"
                    @click="onStart(scenario)"
                >
                    <div class="flex items-center justify-between">
                        <span class="text-lg font-semibold text-slate-800">{{ scenario.name }}</span>
                        <span
                            class="rounded-full px-2 py-0.5 text-xs"
                            :class="scenario.level === 1 ? 'bg-emerald-100 text-emerald-700' : scenario.level === 2 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'"
                        >
                            L{{ scenario.level }}
                        </span>
                    </div>
                    <p class="mt-1 text-xs leading-relaxed text-slate-500">{{ scenario.description }}</p>
                    <div class="mt-2 flex flex-wrap gap-1">
                        <span
                            v-for="word in scenario.target_vocab.slice(0, 4)"
                            :key="word"
                            class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                        >
                            {{ word }}
                        </span>
                    </div>
                </button>
            </div>

            <p v-if="pageError" class="mt-3 text-sm text-red-600">{{ pageError }}</p>
        </section>

        <!-- 对话面板 -->
        <section
            v-else
            class="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <div class="flex items-center gap-2">
                    <span
                        class="rounded-full px-3 py-1 text-xs font-medium"
                        :class="statusBadgeClass"
                    >
                        {{ statusText }}
                    </span>
                    <span v-if="isInSession" class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        {{ language === 'zh' ? '中文对话' : 'English 对话' }}
                    </span>
                </div>
                <div class="flex items-center gap-3 text-xs text-slate-400">
                    <span v-if="state.sessionId">时长 {{ fmtDuration(state.durationS) }}</span>
                    <span v-if="state.uploadedStudentBytes + state.uploadedAiBytes > 0">
                        录音已上传 {{ ((state.uploadedStudentBytes + state.uploadedAiBytes) / 1024 / 1024).toFixed(1) }} MB
                    </span>
                </div>
            </div>

            <div
                ref="scrollBox"
                class="flex-1 space-y-3 overflow-y-auto px-5 py-4"
                style="max-height: 52vh"
            >
                <div v-if="state.subtitles.length === 0" class="py-10 text-center text-sm text-slate-400">
                    对着麦克风说一句话，AI 老师会立刻回答你
                </div>

                <div
                    v-for="(subtitle, index) in state.subtitles"
                    :key="index"
                    class="flex"
                    :class="subtitle.speaker === 'student' ? 'justify-end' : 'justify-start'"
                >
                    <div
                        class="max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed"
                        :class="subtitle.speaker === 'student'
                            ? 'rounded-br-sm bg-emerald-100 text-emerald-900'
                            : 'rounded-bl-sm bg-slate-100 text-slate-800'"
                    >
                        <span class="mr-1.5 text-xs opacity-60">
                            {{ subtitle.speaker === 'student' ? '我' : 'AI 老师' }}
                        </span>
                        {{ subtitle.text }}
                    </div>
                </div>
            </div>

            <div class="border-t border-slate-100 px-5 py-4">
                <div class="flex items-center justify-center gap-8">
                    <button
                        class="flex h-24 w-24 items-center justify-center rounded-full border-4 text-4xl shadow-lg transition active:scale-95"
                        :class="[
                            isInSession ? 'border-indigo-200 bg-indigo-50' : 'border-emerald-200 bg-emerald-50',
                            avatarPulse ? 'animate-breathe' : '',
                        ]"
                        :title="state.status === 'speaking' || state.status === 'thinking' ? '点击打断' : ''"
                        @click="onAvatarTap"
                    >
                        {{ avatarEmoji }}
                    </button>
                </div>

                <p v-if="state.error" class="mt-3 text-center text-sm text-red-600">{{ state.error }}</p>

                <div class="mt-4 flex justify-center gap-3">
                    <button
                        v-if="isInSession"
                        class="rounded-xl bg-rose-500 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-rose-600"
                        @click="onStop"
                    >
                        结束练习
                    </button>

                    <template v-else-if="state.status === 'ended'">
                        <div class="flex items-center gap-4">
                            <p class="text-sm text-slate-600">
                                本次练习 {{ fmtDuration(state.durationS) }}，共 {{ state.subtitles.length }} 句话
                            </p>
                            <button
                                class="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600"
                                @click="dismiss"
                            >
                                再练一次
                            </button>
                        </div>
                    </template>

                    <template v-else-if="state.status === 'error'">
                        <button
                            class="rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                            @click="dismiss"
                        >
                            返回重新开始
                        </button>
                    </template>
                </div>
            </div>
        </section>

        <footer class="mt-6 text-center text-xs text-slate-400">
            录音仅用于内部学习回听 · 请使用 Chrome / Edge / Safari 最新版本
        </footer>
    </div>
</template>
