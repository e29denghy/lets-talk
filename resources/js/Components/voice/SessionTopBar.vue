<script setup lang="ts">
import { computed } from 'vue';
import type { Scenario } from '../../lib/api';
import type { VoiceStatus } from '../../composables/useVoiceChat';
import { themeOf } from './scenarioTheme';

const props = defineProps<{
    scenario: Scenario | null;
    durationS: number;
    quota: { used_seconds: number; limit_seconds: number } | null;
    status: VoiceStatus;
}>();

const emit = defineEmits<{ end: [] }>();

const theme = computed(() => themeOf(props.scenario?.color));

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
    <header
        class="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] bg-white px-4 py-3 shadow-soft sm:px-6"
    >
        <!-- 场景徽章 -->
        <div class="flex items-center gap-2.5">
            <span
                class="flex h-11 w-11 items-center justify-center rounded-2xl border-2 text-xl"
                :class="[theme.soft, theme.border]"
                aria-hidden="true"
            >
                {{ scenario?.emoji ?? '💬' }}
            </span>
            <div>
                <p class="text-[11px] font-bold text-ink-300">当前场景</p>
                <p class="text-sm font-extrabold leading-tight text-ink-700">
                    {{ scenario?.name ?? '…' }}
                    <span v-if="scenario" class="ml-1 text-[10px] font-bold text-ink-300">L{{ scenario.level }}</span>
                </p>
            </div>
        </div>

        <!-- 计时 -->
        <div class="flex items-center gap-2" title="本次练习时长">
            <span class="text-lg" aria-hidden="true">⏱️</span>
            <span class="text-2xl font-extrabold tabular-nums text-ink-700">
                {{ fmtDuration(durationS) }}
            </span>
        </div>

        <!-- 配额 + 结束 -->
        <div class="flex items-center gap-3">
            <p v-if="remainingSeconds !== null" class="hidden text-right sm:block">
                <span class="block text-[11px] font-bold text-ink-300">今日剩余</span>
                <span class="text-sm font-extrabold tabular-nums text-ink-600">
                    {{ fmtDuration(remainingSeconds) }}
                </span>
            </p>
            <button
                type="button"
                class="min-h-11 rounded-full bg-coral-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-soft transition hover:bg-coral-600 active:scale-95"
                @click="emit('end')"
            >
                ✋ 结束练习
            </button>
        </div>
    </header>
</template>
