<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3';

defineProps<{
    sessions: Array<{
        id: number;
        visitor: string;
        grade: number | null;
        scenario: string;
        provider: string;
        status: string;
        duration_s: number;
        turn_count: number;
        cost_micro: number;
        started_at: string | null;
    }>;
}>();

function fmtDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtCost(micro: number): string {
    return `¥${(micro / 1e6).toFixed(4)}`;
}

const statusLabel: Record<string, string> = {
    active: '进行中',
    ended: '已结束',
    connecting: '连接中',
    failed: '失败',
};

function finalizeSession(id: number): void {
    router.post(`/admin/sessions/${id}/finalize`, {}, { preserveScroll: true });
}
</script>

<template>
    <div class="mx-auto max-w-5xl px-4 py-8">
        <div class="mb-6 flex items-center justify-between">
            <h1 class="text-xl font-bold text-ink-700">会话记录</h1>
            <div class="flex gap-4">
                <Link href="/admin/scenarios" class="text-sm text-azure-600 hover:underline">场景管理 →</Link>
                <Link href="/admin/visitors" class="text-sm text-azure-600 hover:underline">访客列表 →</Link>
            </div>
        </div>

        <div class="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-soft">
            <table class="w-full text-left text-sm">
                <thead class="bg-cream-100 text-xs uppercase text-ink-400">
                    <tr>
                        <th class="px-4 py-3">ID</th>
                        <th class="px-4 py-3">访客</th>
                        <th class="px-4 py-3">场景</th>
                        <th class="px-4 py-3">状态</th>
                        <th class="px-4 py-3">时长</th>
                        <th class="px-4 py-3">回合</th>
                        <th class="px-4 py-3">费用（估）</th>
                        <th class="px-4 py-3">开始时间</th>
                        <th class="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-cream-100">
                    <tr v-for="session in sessions" :key="session.id" class="hover:bg-cream-100">
                        <td class="px-4 py-3 font-mono text-xs">{{ session.id }}</td>
                        <td class="px-4 py-3">
                            {{ session.visitor }}
                            <span v-if="session.grade" class="ml-1 text-xs text-ink-300">{{ session.grade }}年级</span>
                        </td>
                        <td class="px-4 py-3">{{ session.scenario }}</td>
                        <td class="px-4 py-3">
                            <span
                                class="rounded-full px-2 py-0.5 text-xs"
                                :class="session.status === 'ended' ? 'bg-mint-100 text-mint-700' : 'bg-sun-100 text-sun-700'"
                            >
                                {{ statusLabel[session.status] ?? session.status }}
                            </span>
                        </td>
                        <td class="px-4 py-3">{{ fmtDuration(session.duration_s) }}</td>
                        <td class="px-4 py-3">{{ session.turn_count }}</td>
                        <td class="px-4 py-3 font-mono text-xs">{{ fmtCost(session.cost_micro) }}</td>
                        <td class="px-4 py-3 text-xs text-ink-400">{{ session.started_at }}</td>
                        <td class="px-4 py-3 text-right">
                            <span v-if="session.status === 'active'">
                                <button
                                    class="mr-3 rounded-lg bg-coral-100 px-2.5 py-1 text-xs text-coral-700 hover:bg-coral-200"
                                    @click="finalizeSession(session.id)"
                                >
                                    强制结束
                                </button>
                            </span>
                            <Link
                                :href="`/admin/sessions/${session.id}`"
                                class="text-azure-600 hover:underline"
                            >
                                查看 →
                            </Link>
                        </td>
                    </tr>
                    <tr v-if="sessions.length === 0">
                        <td colspan="9" class="px-4 py-8 text-center text-ink-300">还没有会话记录</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
