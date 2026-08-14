<script setup lang="ts">
import { ref } from 'vue';
import { Link } from '@inertiajs/vue3';

const props = defineProps<{
    session: {
        id: number;
        visitor: string;
        grade: number | null;
        scenario: string;
        provider: string;
        language: string;
        status: string;
        duration_s: number;
        turn_count: number;
        started_at: string | null;
        ended_at: string | null;
        audio_urls: { student: string | null; ai: string | null };
    };
    turns: Array<{
        seq: number;
        speaker: 'student' | 'assistant';
        text: string;
        latency_ms: number | null;
    }>;
}>();

const studentPlayer = ref<HTMLAudioElement | null>(null);
const aiPlayer = ref<HTMLAudioElement | null>(null);

function playBoth(): void {
    void studentPlayer.value?.play();
    void aiPlayer.value?.play();
}

function pauseBoth(): void {
    studentPlayer.value?.pause();
    aiPlayer.value?.pause();
}
</script>

<template>
    <div class="mx-auto max-w-5xl px-4 py-8">
        <div class="mb-6 flex items-center justify-between">
            <h1 class="text-xl font-bold text-slate-800">会话 #{{ props.session.id }}</h1>
            <Link href="/admin" class="text-sm text-indigo-600 hover:underline">← 返回列表</Link>
        </div>

        <div class="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-4">
            <div>
                <p class="text-xs text-slate-400">访客</p>
                <p class="font-medium text-slate-700">
                    {{ props.session.visitor }}
                    <span v-if="props.session.grade" class="text-xs text-slate-400">{{ props.session.grade }}年级</span>
                </p>
            </div>
            <div>
                <p class="text-xs text-slate-400">场景 / 服务商</p>
                <p class="font-medium text-slate-700">
                    {{ props.session.scenario }} / {{ props.session.provider }}
                    <span class="text-xs text-slate-400">({{ props.session.language === 'zh' ? '中文' : '英文' }})</span>
                </p>
            </div>
            <div>
                <p class="text-xs text-slate-400">时长 / 回合</p>
                <p class="font-medium text-slate-700">
                    {{ Math.floor(props.session.duration_s / 60) }}:{{ String(props.session.duration_s % 60).padStart(2, '0') }}
                    / {{ props.session.turn_count }}
                </p>
            </div>
            <div>
                <p class="text-xs text-slate-400">时间</p>
                <p class="font-medium text-slate-700">{{ props.session.started_at }}</p>
            </div>
        </div>

        <div v-if="props.session.audio_urls.student || props.session.audio_urls.ai" class="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="mb-3 text-sm font-semibold text-slate-700">录音回放（双轨）</h2>

            <div v-if="props.session.audio_urls.student" class="mb-2 flex items-center gap-3">
                <span class="w-16 text-xs text-slate-500">学生：</span>
                <audio ref="studentPlayer" :src="props.session.audio_urls.student" controls class="flex-1" />
            </div>

            <div v-if="props.session.audio_urls.ai" class="flex items-center gap-3">
                <span class="w-16 text-xs text-slate-500">AI：</span>
                <audio ref="aiPlayer" :src="props.session.audio_urls.ai" controls class="flex-1" />
            </div>

            <div class="mt-3 flex gap-2">
                <button
                    class="rounded-lg bg-indigo-500 px-4 py-1.5 text-xs text-white hover:bg-indigo-600"
                    @click="playBoth"
                >
                    双轨同时播放
                </button>
                <button
                    class="rounded-lg bg-slate-100 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                    @click="pauseBoth"
                >
                    暂停
                </button>
            </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">对话文本</h2>
            <div class="divide-y divide-slate-50">
                <div
                    v-for="turn in props.turns"
                    :key="turn.seq"
                    class="flex items-start gap-3 px-5 py-3 text-sm"
                >
                    <span
                        class="mt-0.5 w-14 shrink-0 rounded-full px-2 py-0.5 text-center text-xs"
                        :class="turn.speaker === 'student' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'"
                    >
                        {{ turn.speaker === 'student' ? '学生' : 'AI' }}
                    </span>
                    <p class="flex-1 leading-relaxed text-slate-700">{{ turn.text }}</p>
                    <span v-if="turn.latency_ms !== null" class="shrink-0 text-xs text-slate-400">
                        {{ turn.latency_ms }}ms
                    </span>
                </div>
                <p v-if="props.turns.length === 0" class="px-5 py-8 text-center text-sm text-slate-400">
                    暂无对话文本
                </p>
            </div>
        </div>
    </div>
</template>
