<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    nickname: string | null;
    language: 'en' | 'zh';
    quota: { used_seconds: number; limit_seconds: number } | null;
    disabled?: boolean;
}>();

const emit = defineEmits<{ updateLanguage: [language: 'en' | 'zh'] }>();

const greeting = computed(() => {
    if (props.nickname) return `嗨，${props.nickname}！今天想聊点什么？`;
    return '嗨，同学！今天想聊点什么？';
});

const quotaPercent = computed(() => {
    if (!props.quota || props.quota.limit_seconds === 0) return 0;
    return Math.min(100, Math.round((props.quota.used_seconds / props.quota.limit_seconds) * 100));
});

const quotaColor = computed(() => (quotaPercent.value >= 90 ? 'bg-coral-500' : 'bg-mint-500'));

function fmtDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function pick(lang: 'en' | 'zh'): void {
    if (props.disabled) return;
    emit('updateLanguage', lang);
}
</script>

<template>
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
            <span
                class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-500 text-2xl shadow-soft"
                aria-hidden="true"
            >
                🦊
            </span>
            <div>
                <h1 class="text-xl font-extrabold leading-tight text-ink-700 sm:text-2xl">
                    Let's Talk
                    <span class="ml-1 text-sm font-semibold text-ink-400">· 英语对话练习</span>
                </h1>
                <p class="text-sm font-semibold text-ink-500">{{ greeting }}</p>
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
            <!-- 对话语言切换 -->
            <div
                class="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft"
                role="group"
                aria-label="对话语言"
            >
                <button
                    type="button"
                    class="min-h-10 rounded-full px-4 text-sm font-bold transition"
                    :class="language === 'en' ? 'bg-azure-500 text-white' : 'text-ink-400 hover:text-ink-600'"
                    :disabled="disabled"
                    @click="pick('en')"
                >
                    EN
                </button>
                <button
                    type="button"
                    class="min-h-10 rounded-full px-4 text-sm font-bold transition"
                    :class="language === 'zh' ? 'bg-azure-500 text-white' : 'text-ink-400 hover:text-ink-600'"
                    :disabled="disabled"
                    @click="pick('zh')"
                >
                    中文
                </button>
            </div>

            <!-- 今日配额 -->
            <div
                v-if="quota"
                class="rounded-2xl bg-white px-4 py-2 shadow-soft"
                title="今日可用练习时长"
            >
                <p class="text-[11px] font-semibold text-ink-300">今日可用</p>
                <p class="text-sm font-extrabold tabular-nums text-ink-700">
                    {{ fmtDuration(quota.used_seconds) }} / {{ fmtDuration(quota.limit_seconds) }}
                </p>
                <div class="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-cream-200">
                    <div
                        class="h-full rounded-full transition-all duration-500"
                        :class="quotaColor"
                        :style="{ width: `${quotaPercent}%` }"
                    />
                </div>
            </div>
        </div>
    </header>
</template>
