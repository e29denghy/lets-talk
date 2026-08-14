<script setup lang="ts">
import { reactive } from 'vue';

defineProps<{
    error: string | null;
}>();

const emit = defineEmits<{ submit: [payload: { nickname: string; grade: number | null }] }>();

const form = reactive({ nickname: '', grade: null as number | null });

function submit(): void {
    emit('submit', { nickname: form.nickname.trim(), grade: form.grade });
}
</script>

<template>
    <section
        class="animate-fade-up mx-auto mt-4 max-w-xl rounded-[2rem] border-2 border-sun-200 bg-white p-6 shadow-lift sm:p-8"
    >
        <div class="flex items-start gap-4">
            <span class="text-5xl" aria-hidden="true">👋</span>
            <div>
                <h2 class="text-xl font-extrabold text-ink-700">第一次来？先认识一下</h2>
                <p class="mt-1 text-sm leading-relaxed text-ink-500">
                    不用注册账号。告诉 AI 老师怎么称呼你、读几年级，它就能按你的水平陪你聊。
                </p>
            </div>
        </div>

        <form class="mt-6 space-y-5" @submit.prevent="submit">
            <label class="block">
                <span class="mb-1.5 block text-sm font-bold text-ink-600">你的昵称（可以不填）</span>
                <input
                    v-model="form.nickname"
                    type="text"
                    maxlength="50"
                    placeholder="例如：小明"
                    class="w-full rounded-2xl border-2 border-cream-200 bg-cream-50 px-4 py-3 text-base font-semibold text-ink-700 placeholder:text-ink-300 focus:border-sun-400 focus:outline-none focus:ring-4 focus:ring-sun-400/30"
                />
            </label>

            <fieldset>
                <legend class="mb-1.5 text-sm font-bold text-ink-600">你读几年级？（可以不选）</legend>
                <div class="flex flex-wrap gap-2">
                    <button
                        v-for="g in 6"
                        :key="g"
                        type="button"
                        class="min-h-11 rounded-full border-2 px-4 text-sm font-bold transition active:scale-95"
                        :class="
                            form.grade === g
                                ? 'border-sun-500 bg-sun-500 text-ink-700'
                                : 'border-cream-200 bg-white text-ink-500 hover:border-sun-400'
                        "
                        :aria-pressed="form.grade === g"
                        @click="form.grade = form.grade === g ? null : g"
                    >
                        {{ g }} 年级
                    </button>
                </div>
            </fieldset>

            <p v-if="error" class="rounded-2xl bg-coral-100 px-4 py-3 text-sm font-semibold text-coral-700">
                {{ error }}
            </p>

            <button
                type="submit"
                class="w-full rounded-full bg-sun-500 py-4 text-lg font-extrabold text-ink-700 shadow-lift transition hover:bg-sun-600 hover:text-white active:scale-[0.98]"
            >
                🎤 开始练习
            </button>
        </form>
    </section>
</template>
