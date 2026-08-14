<script setup lang="ts">
import type { Scenario } from '../../lib/api';
import ScenarioCard from './ScenarioCard.vue';

defineProps<{
    scenarios: Scenario[];
    loading: boolean;
    error: string | null;
    activeId: number | null;
}>();

const emit = defineEmits<{ select: [scenario: Scenario] }>();
</script>

<template>
    <section aria-label="场景选择">
        <div class="mb-4 flex items-baseline justify-between">
            <h2 class="text-lg font-bold text-ink-700">选一个想聊的场景</h2>
            <span class="text-xs font-semibold text-ink-300">点卡片就开始 👇</span>
        </div>

        <div v-if="loading" class="rounded-3xl bg-white p-10 text-center text-sm text-ink-400 shadow-soft">
            正在准备场景…
        </div>

        <div
            v-else-if="error"
            class="rounded-3xl border-2 border-coral-200 bg-coral-100/60 p-6 text-sm font-medium text-coral-700"
        >
            {{ error }}
        </div>

        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            <ScenarioCard
                v-for="scenario in scenarios"
                :key="scenario.id"
                :scenario="scenario"
                :selected="scenario.id === activeId"
                @select="emit('select', $event)"
            />
        </div>
    </section>
</template>
