<script setup lang="ts">
const props = defineProps<{
    /** 麦克风实时电平 0~1（useVoiceChat.state.micLevel） */
    level: number;
}>();

/** 均衡器柱形高度图案（px），共 24 根，左右对称 */
const BAR_HEIGHTS = [5, 9, 13, 17, 21, 26, 23, 19, 15, 11, 7, 5, 5, 7, 11, 15, 19, 23, 26, 21, 17, 13, 9, 5];

/** 第 i 根柱子的点亮程度（0~1） */
function barOpacity(index: number): number {
    const litCount = props.level * BAR_HEIGHTS.length;
    return Math.max(0, Math.min(1, litCount - index));
}
</script>

<template>
    <div
        class="flex h-8 items-end justify-center gap-[3px]"
        role="img"
        aria-label="麦克风音量"
    >
        <div
            v-for="(height, index) in BAR_HEIGHTS"
            :key="index"
            class="relative w-[3px] overflow-hidden rounded-full bg-cream-200"
            :style="{ height: `${height}px` }"
        >
            <div
                class="absolute inset-x-0 bottom-0 rounded-full bg-mint-500 transition-opacity duration-100"
                :style="{ height: '100%', opacity: barOpacity(index) }"
            />
        </div>
    </div>
</template>
