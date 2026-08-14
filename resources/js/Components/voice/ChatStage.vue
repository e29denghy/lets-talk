<script setup lang="ts">
import { computed } from 'vue';
import type { VoiceStatus } from '../../composables/useVoiceChat';
import Mascot from './Mascot.vue';
import MicLevelMeter from './MicLevelMeter.vue';

const props = defineProps<{
    status: VoiceStatus;
    micLevel: number;
    durationS: number;
    /** 会话中的错误/重连提示 */
    error: string | null;
}>();

const hint = computed(() => {
    switch (props.status) {
        case 'connecting':
            return '正在连接语音老师…';
        case 'listening':
            return '我在听，开口说英语吧！';
        case 'thinking':
            return '让我想一想…';
        case 'speaking':
            return 'AI 老师正在说，开口就能打断它';
        default:
            return '';
    }
});

const hintClass = computed(() => {
    switch (props.status) {
        case 'listening':
            return 'text-mint-700';
        case 'thinking':
            return 'text-azure-600';
        case 'speaking':
            return 'text-grape-600';
        default:
            return 'text-ink-400';
    }
});

/** 听了几秒却没拾到任何声音 → 提示检查麦克风 */
const micTrouble = computed(
    () => props.status === 'listening' && props.durationS >= 4 && props.micLevel === 0,
);
</script>

<template>
    <section class="flex flex-col items-center justify-center gap-5 rounded-[2rem] bg-white px-4 py-8 shadow-soft sm:py-10">
        <Mascot :status="status" />

        <!-- 状态提示（大字，辅助信号） -->
        <p
            class="min-h-6 text-center text-lg font-extrabold transition-colors sm:text-xl"
            :class="hintClass"
            aria-live="polite"
        >
            {{ hint }}
        </p>

        <!-- 麦克风电平：说话时逐级点亮 -->
        <div class="flex w-full max-w-xs flex-col items-center gap-2">
            <MicLevelMeter :level="micLevel" />
            <p class="text-[11px] font-semibold text-ink-300">
                {{ status === 'speaking' || status === 'thinking' ? '想插话？直接开口说' : '说话时，这些小柱子会亮起来' }}
            </p>
        </div>

        <!-- 麦克风排障提示 -->
        <p
            v-if="micTrouble"
            class="animate-fade-in rounded-full bg-coral-100 px-4 py-2 text-xs font-bold text-coral-700"
        >
            🤫 还没听到你的声音？检查一下麦克风是否打开、有没有允许网页使用麦克风
        </p>

        <!-- 会话中的错误/重连提示 -->
        <p
            v-if="error"
            class="animate-fade-in max-w-md rounded-2xl bg-amber-100 px-4 py-2.5 text-center text-xs font-bold text-amber-700"
            aria-live="assertive"
        >
            ⚠️ {{ error }}
        </p>
    </section>
</template>
