<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

defineProps<{
    visitors: Array<{
        id: number;
        uuid: string;
        nickname: string | null;
        grade: number | null;
        sessions_count: number;
        used_today_s: number;
        first_seen_at: string | null;
        last_seen_at: string | null;
    }>;
}>();

function fmtDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
    <div class="mx-auto max-w-5xl px-4 py-8">
        <div class="mb-6 flex items-center justify-between">
            <h1 class="text-xl font-bold text-ink-700">访客列表</h1>
            <Link href="/admin" class="text-sm text-azure-600 hover:underline">← 会话记录</Link>
        </div>

        <div class="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-soft">
            <table class="w-full text-left text-sm">
                <thead class="bg-cream-100 text-xs uppercase text-ink-400">
                    <tr>
                        <th class="px-4 py-3">ID</th>
                        <th class="px-4 py-3">昵称</th>
                        <th class="px-4 py-3">年级</th>
                        <th class="px-4 py-3">会话数</th>
                        <th class="px-4 py-3">今日用时</th>
                        <th class="px-4 py-3">首次访问</th>
                        <th class="px-4 py-3">最近访问</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-cream-100">
                    <tr v-for="visitor in visitors" :key="visitor.id" class="hover:bg-cream-100">
                        <td class="px-4 py-3 font-mono text-xs">{{ visitor.uuid }}</td>
                        <td class="px-4 py-3">{{ visitor.nickname ?? '（未填）' }}</td>
                        <td class="px-4 py-3">{{ visitor.grade ? `${visitor.grade} 年级` : '—' }}</td>
                        <td class="px-4 py-3">{{ visitor.sessions_count }}</td>
                        <td class="px-4 py-3">{{ fmtDuration(visitor.used_today_s) }}</td>
                        <td class="px-4 py-3 text-xs text-ink-400">{{ visitor.first_seen_at }}</td>
                        <td class="px-4 py-3 text-xs text-ink-400">{{ visitor.last_seen_at }}</td>
                    </tr>
                    <tr v-if="visitors.length === 0">
                        <td colspan="7" class="px-4 py-8 text-center text-ink-300">还没有访客</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
