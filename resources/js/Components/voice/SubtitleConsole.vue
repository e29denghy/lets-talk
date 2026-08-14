<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Subtitle, VoiceStatus } from '../../composables/useVoiceChat';

const props = defineProps<{
    subtitles: readonly Subtitle[];
    status: VoiceStatus;
    unitText: string | null;
}>();

const scrollBox = ref<HTMLElement | null>(null);
const showUnitText = ref(false);

const lastSubtitle = computed(() => props.subtitles[props.subtitles.length - 1] ?? null);

/** 打字占位：思考中，或 AI 正在说但还没出字幕 */
const showTyping = computed(() => {
    if (props.status === 'thinking') return true;
    if (props.status === 'speaking' && lastSubtitle.value?.speaker !== 'assistant') return true;
    return false;
});

const typingLabel = computed(() => (props.status === 'thinking' ? 'AI 老师在想…' : 'AI 老师正在说…'));

watch(
    () => props.subtitles.length,
    async () => {
        await nextTick();
        if (scrollBox.value) {
            scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
        }
    },
);
</script>

<template>
    <section class="flex min-h-0 flex-1 flex-col rounded-[2rem] bg-white shadow-soft">
        <!-- 台头 -->
        <header class="flex items-center justify-between border-b-2 border-cream-100 px-5 py-3">
            <h2 class="text-sm font-extrabold text-ink-600">💬 对话字幕</h2>
            <button
                v-if="unitText"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95"
                :class="showUnitText ? 'bg-azure-100 text-azure-700' : 'bg-cream-100 text-ink-500 hover:bg-cream-200'"
                :aria-expanded="showUnitText"
                @click="showUnitText = !showUnitText"
            >
                📖 课文 {{ showUnitText ? '收起 ▲' : '展开 ▼' }}
            </button>
        </header>

        <!-- 课文抽屉 -->
        <div
            v-if="showUnitText && unitText"
            class="nice-scroll max-h-40 shrink-0 overflow-y-auto border-b-2 border-cream-100 bg-cream-50 px-5 py-3"
        >
            <pre class="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-500">{{ unitText }}</pre>
        </div>

        <!-- 字幕流 -->
        <div ref="scrollBox" class="nice-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            <div v-if="subtitles.length === 0 && !showTyping" class="py-12 text-center">
                <p class="text-4xl" aria-hidden="true">🦊</p>
                <p class="mt-3 text-sm font-semibold text-ink-400">
                    对着麦克风说一句话，AI 老师马上回答你
                </p>
            </div>

            <template v-for="(subtitle, index) in subtitles" :key="`${subtitle.at}-${index}`">
                <!-- 学生：靠右，薄荷色 -->
                <div v-if="subtitle.speaker === 'student'" class="animate-fade-up flex justify-end">
                    <div class="flex max-w-[85%] items-end gap-2">
                        <div class="rounded-2xl rounded-br-md bg-mint-100 px-4 py-2.5">
                            <p class="text-[11px] font-bold text-mint-700">我</p>
                            <p class="text-base font-semibold leading-relaxed text-ink-700">
                                {{ subtitle.text }}
                            </p>
                        </div>
                        <span
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint-500 text-sm shadow-soft"
                            aria-hidden="true"
                        >
                            🧒
                        </span>
                    </div>
                </div>

                <!-- AI：靠左，天蓝色 -->
                <div v-else class="animate-fade-up flex justify-start">
                    <div class="flex max-w-[85%] items-end gap-2">
                        <span
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sun-500 text-sm shadow-soft"
                            aria-hidden="true"
                        >
                            🦊
                        </span>
                        <div class="rounded-2xl rounded-bl-md border-2 border-azure-100 bg-azure-50 px-4 py-2.5">
                            <p class="text-[11px] font-bold text-azure-600">AI 老师</p>
                            <p class="text-base font-semibold leading-relaxed text-ink-700">
                                {{ subtitle.text }}
                            </p>
                        </div>
                    </div>
                </div>
            </template>

            <!-- 打字占位气泡 -->
            <div v-if="showTyping" class="animate-fade-up flex justify-start">
                <div class="flex items-end gap-2">
                    <span
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sun-500 text-sm shadow-soft"
                        aria-hidden="true"
                    >
                        🦊
                    </span>
                    <div
                        class="flex items-center gap-2 rounded-2xl rounded-bl-md border-2 border-azure-100 bg-azure-50 px-4 py-3"
                        aria-live="polite"
                    >
                        <span class="animate-dots h-2 w-2 rounded-full bg-azure-500" />
                        <span class="animate-dots h-2 w-2 rounded-full bg-azure-500" style="animation-delay: 0.15s" />
                        <span class="animate-dots h-2 w-2 rounded-full bg-azure-500" style="animation-delay: 0.3s" />
                        <span class="ml-1 text-xs font-semibold text-ink-400">{{ typingLabel }}</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
