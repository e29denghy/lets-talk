<script setup lang="ts">
import { computed } from 'vue';
import type { Scenario } from '../../lib/api';
import { themeOf } from './scenarioTheme';

const props = defineProps<{
    scenario: Scenario;
    selected?: boolean;
}>();

const emit = defineEmits<{ select: [scenario: Scenario] }>();

const theme = computed(() => themeOf(props.scenario.color));
const fallbackEmoji = computed(() => props.scenario.emoji ?? '💬');
</script>

<template>
    <button
        type="button"
        class="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-transparent bg-white text-left shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lift active:scale-[0.97]"
        :class="selected ? `ring-4 ${theme.ring} ${theme.border}` : ''"
        @click="emit('select', scenario)"
    >
        <!-- 插图区：主题渐变 + 大 emoji -->
        <div
            class="flex h-24 items-center justify-center bg-gradient-to-br sm:h-28"
            :class="theme.gradient"
        >
            <span
                class="text-5xl drop-shadow-sm transition duration-200 group-hover:scale-110 sm:text-6xl"
                aria-hidden="true"
            >
                {{ fallbackEmoji }}
            </span>
        </div>

        <div class="flex flex-1 flex-col gap-1.5 p-4">
            <div class="flex items-center justify-between gap-2">
                <h3 class="text-base font-bold text-ink-700">{{ scenario.name }}</h3>
                <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                    :class="theme.badge"
                >
                    L{{ scenario.level }}
                </span>
            </div>

            <p
                v-if="scenario.description"
                class="line-clamp-2 text-xs leading-relaxed text-ink-400"
            >
                {{ scenario.description }}
            </p>

            <div v-if="scenario.target_vocab.length" class="mt-auto flex flex-wrap gap-1 pt-1">
                <span
                    v-for="word in scenario.target_vocab.slice(0, 3)"
                    :key="word"
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    :class="theme.chip"
                >
                    {{ word }}
                </span>
            </div>
        </div>
    </button>
</template>
