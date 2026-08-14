<script setup lang="ts">
import { computed } from 'vue';
import type { Scenario } from '../../lib/api';
import { themeOf } from './scenarioTheme';

const props = defineProps<{
    scenario: Scenario | null;
    durationS: number;
    studentTurns: number;
    sentenceCount: number;
    quota: { used_seconds: number; limit_seconds: number } | null;
}>();

const emit = defineEmits<{ again: []; home: [] }>();

const theme = computed(() => themeOf(props.scenario?.color));

/** 鼓励性星级：按开口次数折算（1~5），真实发音评分在阶段二 */
const stars = computed(() => {
    const t = props.studentTurns;
    if (t >= 8) return 5;
    if (t >= 5) return 4;
    if (t >= 3) return 3;
    if (t >= 1) return 2;
    return 1;
});

const cheer = computed(() => {
    const map: Record<number, string> = {
        1: '迈出第一步就很棒，下次多说几句！',
        2: '开口说英语了，真勇敢！',
        3: '聊得不错，继续保持！',
        4: '太棒了，你越说越流利啦！',
        5: '超级棒！你是今天的英语小明星！',
    };
    return map[stars.value];
});

function fmtDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

const remainingSeconds = computed(() => {
    if (!props.quota || props.quota.limit_seconds === 0) return null;
    return Math.max(0, props.quota.limit_seconds - props.quota.used_seconds);
});
</script>

<template>
    <section class="animate-fade-up mx-auto w-full max-w-2xl rounded-[2rem] border-2 border-sun-200 bg-white p-6 shadow-lift sm:p-10">
        <!-- 星星 -->
        <div class="flex items-center justify-center gap-1.5" aria-label="获得 {{ stars }} 颗星">
            <span
                v-for="i in 5"
                :key="i"
                class="animate-star-pop text-4xl sm:text-5xl"
                :style="{ animationDelay: `${0.15 + i * 0.12}s` }"
                :aria-hidden="true"
            >
                {{ i <= stars ? '⭐' : '🌑' }}
            </span>
        </div>

        <p class="mt-4 text-center text-lg font-extrabold text-ink-700">{{ cheer }}</p>

        <!-- 数据大卡片 -->
        <div class="mt-6 grid grid-cols-3 gap-3">
            <div class="rounded-2xl bg-cream-100 px-3 py-4 text-center">
                <p class="text-xl" aria-hidden="true">⏱️</p>
                <p class="mt-1 text-xl font-extrabold tabular-nums text-ink-700">
                    {{ fmtDuration(durationS) }}
                </p>
                <p class="text-[11px] font-bold text-ink-400">练习时长</p>
            </div>
            <div class="rounded-2xl bg-mint-100 px-3 py-4 text-center">
                <p class="text-xl" aria-hidden="true">🗣️</p>
                <p class="mt-1 text-xl font-extrabold tabular-nums text-ink-700">{{ studentTurns }}</p>
                <p class="text-[11px] font-bold text-ink-400">开口次数</p>
            </div>
            <div class="rounded-2xl bg-azure-100 px-3 py-4 text-center">
                <p class="text-xl" aria-hidden="true">💬</p>
                <p class="mt-1 text-xl font-extrabold tabular-nums text-ink-700">{{ sentenceCount }}</p>
                <p class="text-[11px] font-bold text-ink-400">对话句数</p>
            </div>
        </div>

        <!-- 目标词汇回顾 -->
        <div v-if="scenario?.target_vocab.length" class="mt-6">
            <p class="text-sm font-extrabold text-ink-600">📚 今天的目标词汇</p>
            <div class="mt-2 flex flex-wrap gap-2">
                <span
                    v-for="word in scenario.target_vocab.slice(0, 10)"
                    :key="word"
                    class="rounded-full border-2 px-3 py-1 text-xs font-bold"
                    :class="[theme.soft, theme.border, theme.text]"
                >
                    {{ word }}
                </span>
            </div>
        </div>

        <!-- 操作 -->
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
                type="button"
                class="min-h-12 rounded-full bg-sun-500 px-8 py-3 text-base font-extrabold text-ink-700 shadow-lift transition hover:bg-sun-600 hover:text-white active:scale-[0.97]"
                @click="emit('again')"
            >
                🔁 再练一次
            </button>
            <button
                type="button"
                class="min-h-12 rounded-full border-2 border-cream-200 bg-white px-8 py-3 text-base font-extrabold text-ink-600 transition hover:border-sun-400 active:scale-[0.97]"
                @click="emit('home')"
            >
                🎯 换个场景
            </button>
        </div>

        <p v-if="remainingSeconds !== null" class="mt-5 text-center text-xs font-semibold text-ink-300">
            今日还剩 {{ fmtDuration(remainingSeconds) }} 练习时间
        </p>
    </section>
</template>
