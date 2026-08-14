<script setup lang="ts">
import { computed } from 'vue';
import type { VoiceStatus } from '../../composables/useVoiceChat';

const props = defineProps<{
    status: VoiceStatus;
}>();

/** 整体姿态动画：听=点头摇摆，想=歪头，说/空闲/结束=呼吸 */
const bodyAnim = computed(() => {
    switch (props.status) {
        case 'listening':
            return 'animate-nod';
        case 'thinking':
            return 'animate-think';
        case 'error':
            return '';
        default:
            return 'animate-breathe';
    }
});
</script>

<template>
    <div class="relative mx-auto h-44 w-44 sm:h-56 sm:w-56" aria-hidden="true">
        <!-- 听：绿色光环 -->
        <span
            v-if="status === 'listening'"
            class="animate-halo absolute -inset-1 rounded-full bg-mint-400/50"
        />
        <!-- 说：紫色声波涟漪 -->
        <template v-if="status === 'speaking'">
            <span class="animate-ripple absolute -inset-1 rounded-full bg-grape-400/40" />
            <span
                class="animate-ripple absolute -inset-1 rounded-full bg-grape-400/30"
                style="animation-delay: 0.6s"
            />
        </template>

        <!-- 想：省略号气泡 -->
        <span
            v-if="status === 'thinking'"
            class="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 shadow-lift"
        >
            <span class="animate-dots h-2 w-2 rounded-full bg-grape-500" />
            <span class="animate-dots h-2 w-2 rounded-full bg-grape-500" style="animation-delay: 0.15s" />
            <span class="animate-dots h-2 w-2 rounded-full bg-grape-500" style="animation-delay: 0.3s" />
        </span>

        <!-- 小狐狸 AI 老师 -->
        <svg viewBox="0 0 200 200" class="h-full w-full drop-shadow-sm" :class="bodyAnim">
            <!-- 耳朵 -->
            <path
                d="M36 84 Q34 38 52 24 Q66 14 82 48 Q70 60 36 84 Z"
                fill="#ffce57"
                stroke="#2b2b3a"
                stroke-opacity="0.08"
                stroke-width="3"
            />
            <path
                d="M164 84 Q166 38 148 24 Q134 14 118 48 Q130 60 164 84 Z"
                fill="#ffce57"
                stroke="#2b2b3a"
                stroke-opacity="0.08"
                stroke-width="3"
            />
            <path d="M47 70 Q46 42 57 34 Q64 30 72 46 Q66 54 47 70 Z" fill="#fffdf8" />
            <path d="M153 70 Q154 42 143 34 Q136 30 128 46 Q134 54 153 70 Z" fill="#fffdf8" />

            <!-- 头 -->
            <ellipse cx="100" cy="122" rx="76" ry="64" fill="#ffce57" />

            <!-- 脸 -->
            <ellipse cx="100" cy="136" rx="42" ry="31" fill="#fffdf8" />

            <!-- 眼睛（眨眼） -->
            <g class="animate-blink" style="transform-box: fill-box; transform-origin: center">
                <ellipse cx="73" cy="106" rx="10" ry="12" fill="#2b2b3a" />
                <ellipse cx="127" cy="106" rx="10" ry="12" fill="#2b2b3a" />
                <circle cx="76" cy="101" r="3.2" fill="#fffdf8" />
                <circle cx="130" cy="101" r="3.2" fill="#fffdf8" />
            </g>

            <!-- 腮红 -->
            <ellipse cx="56" cy="126" rx="11" ry="6.5" fill="#ffc7c2" />
            <ellipse cx="144" cy="126" rx="11" ry="6.5" fill="#ffc7c2" />

            <!-- 鼻子 -->
            <ellipse cx="100" cy="127" rx="8.5" ry="6.5" fill="#2b2b3a" />

            <!-- 嘴巴：说话时开合 / 出错时难过 / 平时微笑 -->
            <g
                v-if="status === 'speaking'"
                class="animate-talk"
                style="transform-box: fill-box; transform-origin: center top"
            >
                <ellipse cx="100" cy="141" rx="11" ry="9" fill="#2b2b3a" />
                <ellipse cx="100" cy="145.5" rx="6.5" ry="4" fill="#ff6b6b" />
            </g>
            <path
                v-else-if="status === 'error'"
                d="M87 140 Q100 130 113 140"
                fill="none"
                stroke="#2b2b3a"
                stroke-width="4.5"
                stroke-linecap="round"
            />
            <path
                v-else
                d="M87 137 Q100 151 113 137"
                fill="none"
                stroke="#2b2b3a"
                stroke-width="4.5"
                stroke-linecap="round"
            />
        </svg>
    </div>
</template>
