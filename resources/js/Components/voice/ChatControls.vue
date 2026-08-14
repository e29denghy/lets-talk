<script setup lang="ts">
import { computed } from 'vue';
import type { VoiceStatus } from '../../composables/useVoiceChat';

const props = defineProps<{
    status: VoiceStatus;
}>();

const emit = defineEmits<{ interrupt: []; stop: [] }>();

/** 中心大按钮样式：按状态换色 */
const buttonClass = computed(() => {
    switch (props.status) {
        case 'listening':
            return 'bg-mint-500 text-white shadow-lift hover:bg-mint-600';
        case 'thinking':
            return 'bg-azure-100 text-azure-600 cursor-default';
        case 'speaking':
            return 'bg-grape-500 text-white shadow-lift hover:bg-grape-600';
        default:
            return 'bg-cream-200 text-ink-400 cursor-wait';
    }
});

const buttonEmoji = computed(() => {
    switch (props.status) {
        case 'listening':
            return '🎙️';
        case 'thinking':
            return '🤔';
        case 'speaking':
            return '🙋';
        default:
            return '⏳';
    }
});

const buttonLabel = computed(() => {
    switch (props.status) {
        case 'listening':
            return '正在听你说话';
        case 'thinking':
            return 'AI 老师正在想';
        case 'speaking':
            return '点我，或直接开口打断';
        default:
            return '正在连接…';
    }
});

const isInterruptible = computed(() => props.status === 'speaking' || props.status === 'thinking');

function onMainTap(): void {
    if (isInterruptible.value) {
        emit('interrupt');
    }
}
</script>

<template>
    <footer class="flex items-center justify-center gap-6 rounded-[2rem] bg-white px-4 py-4 shadow-soft sm:gap-10">
        <!-- 中心状态/打断大按钮 -->
        <div class="flex flex-col items-center gap-2">
            <button
                type="button"
                class="flex h-20 w-20 items-center justify-center rounded-full text-3xl transition active:scale-90 sm:h-24 sm:w-24 sm:text-4xl"
                :class="[buttonClass, { 'ring-4 ring-grape-400/40': isInterruptible }]"
                :aria-label="buttonLabel"
                :title="buttonLabel"
                @click="onMainTap"
            >
                {{ buttonEmoji }}
            </button>
            <p class="text-xs font-bold text-ink-400">{{ buttonLabel }}</p>
        </div>

        <!-- 结束 -->
        <div class="flex flex-col items-center gap-2">
            <button
                type="button"
                class="flex h-14 w-14 items-center justify-center rounded-full border-2 border-coral-200 bg-coral-100 text-2xl transition hover:bg-coral-200 active:scale-90 sm:h-16 sm:w-16"
                aria-label="结束练习"
                title="结束练习"
                @click="emit('stop')"
            >
                🛑
            </button>
            <p class="text-xs font-bold text-ink-400">结束练习</p>
        </div>
    </footer>
</template>
