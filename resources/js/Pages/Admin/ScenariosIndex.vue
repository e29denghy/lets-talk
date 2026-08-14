<script setup lang="ts">
import { ref } from 'vue';
import { Link, useForm } from '@inertiajs/vue3';

interface ScenarioRow {
    id: number;
    name: string;
    slug: string;
    level: number;
    description: string | null;
    system_prompt: string;
    target_vocab: string;
    voice_config: string;
    sort_order: number;
    is_active: boolean;
}

const props = defineProps<{ scenarios: ScenarioRow[] }>();

const editingId = ref<number | null>(null);

const form = useForm({
    name: '',
    slug: '',
    level: 1,
    description: '',
    system_prompt: '',
    target_vocab: '',
    voice_config: '',
    sort_order: 0,
    is_active: true,
});

function resetForm(): void {
    editingId.value = null;
    form.reset();
    form.clearErrors();
}

function startCreate(): void {
    editingId.value = null;
    form.reset();
    form.clearErrors();
    form.is_active = true;
    form.sort_order = (props.scenarios.at(-1)?.sort_order ?? 0) + 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startEdit(scenario: ScenarioRow): void {
    editingId.value = scenario.id;
    form.name = scenario.name;
    form.slug = scenario.slug;
    form.level = scenario.level;
    form.description = scenario.description ?? '';
    form.system_prompt = scenario.system_prompt;
    form.target_vocab = scenario.target_vocab;
    form.voice_config = scenario.voice_config;
    form.sort_order = scenario.sort_order;
    form.is_active = scenario.is_active;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function submit(): void {
    if (editingId.value !== null) {
        form.put(`/admin/scenarios/${editingId.value}`, {
            preserveScroll: true,
            onSuccess: resetForm,
        });
        return;
    }
    form.post('/admin/scenarios', {
        preserveScroll: true,
        onSuccess: resetForm,
    });
}

function remove(scenario: ScenarioRow): void {
    if (confirm(`确认删除场景「${scenario.name}」？已有会话记录会保留（场景置空）。`)) {
        form.delete(`/admin/scenarios/${scenario.id}`, { preserveScroll: true });
    }
}

const levelLabel: Record<number, string> = { 1: 'L1 入门', 2: 'L2 进阶', 3: 'L3 挑战' };
</script>

<template>
    <div class="mx-auto max-w-6xl px-4 py-8">
        <div class="mb-6 flex items-center justify-between">
            <h1 class="text-xl font-bold text-slate-800">场景卡片管理</h1>
            <div class="flex gap-4">
                <Link href="/admin" class="text-sm text-indigo-600 hover:underline">← 会话记录</Link>
                <Link href="/admin/visitors" class="text-sm text-indigo-600 hover:underline">访客列表 →</Link>
            </div>
        </div>

        <!-- 新建 / 编辑表单 -->
        <form class="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" @submit.prevent="submit">
            <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-semibold text-slate-700">
                    {{ editingId !== null ? `编辑场景 #${editingId}` : '新建场景' }}
                </h2>
                <button type="button" class="text-xs text-slate-400 hover:text-slate-600" @click="resetForm">清空</button>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">名称 *</span>
                    <input v-model="form.name" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="例如：打招呼" />
                    <span v-if="form.errors.name" class="text-xs text-red-600">{{ form.errors.name }}</span>
                </label>
                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">slug *（英文标识）</span>
                    <input v-model="form.slug" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="greetings" />
                    <span v-if="form.errors.slug" class="text-xs text-red-600">{{ form.errors.slug }}</span>
                </label>
                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">难度</span>
                    <select v-model="form.level" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option v-for="l in 3" :key="l" :value="l">{{ levelLabel[l] }}</option>
                    </select>
                </label>
                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">排序（小在前）</span>
                    <input v-model.number="form.sort_order" type="number" min="0" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
            </div>

            <label class="mt-3 block">
                <span class="mb-1 block text-xs text-slate-500">一句话描述（卡片上显示）</span>
                <input v-model="form.description" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="例如：练习打招呼与自我介绍" />
            </label>

            <label class="mt-3 block">
                <span class="mb-1 block text-xs text-slate-500">System Prompt *（支持 {nickname} {grade} 占位符；建议包含「每轮 2-3 句、一次只问一个问题、语速非常慢」要求）</span>
                <textarea v-model="form.system_prompt" rows="6" class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed" />
                <span v-if="form.errors.system_prompt" class="text-xs text-red-600">{{ form.errors.system_prompt }}</span>
            </label>

            <div class="mt-3 grid grid-cols-2 gap-3">
                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">目标词汇（逗号分隔，卡片标签用）</span>
                    <input v-model="form.target_vocab" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="hello, hi, name" />
                </label>
                <label class="block">
                    <span class="mb-1 block text-xs text-slate-500">音色等配置（JSON，可选，留空用默认）</span>
                    <input v-model="form.voice_config" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" placeholder='{"voice":"Serena"}' />
                </label>
            </div>

            <div class="mt-4 flex items-center justify-between">
                <label class="flex items-center gap-2 text-sm text-slate-600">
                    <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
                    上架（首页可见）
                </label>
                <button
                    type="submit"
                    :disabled="form.processing"
                    class="rounded-lg bg-indigo-500 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
                >
                    {{ editingId !== null ? '保存修改' : '创建场景' }}
                </button>
            </div>
        </form>

        <!-- 场景列表 -->
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                        <th class="px-4 py-3">#</th>
                        <th class="px-4 py-3">名称 / slug</th>
                        <th class="px-4 py-3">难度</th>
                        <th class="px-4 py-3">描述</th>
                        <th class="px-4 py-3">状态</th>
                        <th class="px-4 py-3 text-right">操作</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="scenario in scenarios" :key="scenario.id" class="hover:bg-slate-50">
                        <td class="px-4 py-3 font-mono text-xs">{{ scenario.id }}</td>
                        <td class="px-4 py-3">
                            <p class="font-medium text-slate-700">{{ scenario.name }}</p>
                            <p class="font-mono text-xs text-slate-400">{{ scenario.slug }}</p>
                        </td>
                        <td class="px-4 py-3">{{ levelLabel[scenario.level] }}</td>
                        <td class="px-4 py-3 text-xs text-slate-500">{{ scenario.description }}</td>
                        <td class="px-4 py-3">
                            <span
                                class="rounded-full px-2 py-0.5 text-xs"
                                :class="scenario.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'"
                            >
                                {{ scenario.is_active ? '已上架' : '已下架' }}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right">
                            <button class="mr-3 text-indigo-600 hover:underline" @click="startEdit(scenario)">编辑</button>
                            <button class="text-rose-500 hover:underline" @click="remove(scenario)">删除</button>
                        </td>
                    </tr>
                    <tr v-if="scenarios.length === 0">
                        <td colspan="6" class="px-4 py-8 text-center text-slate-400">
                            还没有场景，用上方表单创建第一个吧
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="mt-4 flex justify-center">
            <button
                class="rounded-lg border border-dashed border-slate-300 px-6 py-2 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
                @click="startCreate"
            >
                + 新建场景
            </button>
        </div>
    </div>
</template>
