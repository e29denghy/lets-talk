/**
 * 场景主题色 → Tailwind 类映射。
 * 注意：类名必须是完整字面量（Tailwind 扫描器才能识别），
 * 全部颜色 token 见 resources/css/app.css @theme。
 */

export interface ScenarioTheme {
    /** 卡片顶部渐变底 */
    gradient: string;
    /** 难度徽章 */
    badge: string;
    /** 词汇小片 */
    chip: string;
    /** 会话中的柔和底色 */
    soft: string;
    /** 强调文字色 */
    text: string;
    /** 选中/聚焦描边色 */
    border: string;
    /** 选中光环色 */
    ring: string;
}

export const scenarioTheme: Record<string, ScenarioTheme> = {
    sun: {
        gradient: 'from-sun-100 via-cream-50 to-sun-200',
        badge: 'bg-sun-500 text-ink-700',
        chip: 'bg-sun-100 text-sun-700',
        soft: 'bg-sun-100/80',
        text: 'text-sun-700',
        border: 'border-sun-400',
        ring: 'ring-sun-400',
    },
    coral: {
        gradient: 'from-coral-100 via-cream-50 to-coral-200',
        badge: 'bg-coral-500 text-white',
        chip: 'bg-coral-100 text-coral-700',
        soft: 'bg-coral-100/80',
        text: 'text-coral-600',
        border: 'border-coral-400',
        ring: 'ring-coral-400',
    },
    mint: {
        gradient: 'from-mint-100 via-cream-50 to-mint-200',
        badge: 'bg-mint-500 text-white',
        chip: 'bg-mint-100 text-mint-700',
        soft: 'bg-mint-100/80',
        text: 'text-mint-700',
        border: 'border-mint-400',
        ring: 'ring-mint-400',
    },
    azure: {
        gradient: 'from-azure-100 via-cream-50 to-azure-200',
        badge: 'bg-azure-500 text-white',
        chip: 'bg-azure-100 text-azure-700',
        soft: 'bg-azure-100/80',
        text: 'text-azure-700',
        border: 'border-azure-400',
        ring: 'ring-azure-400',
    },
    grape: {
        gradient: 'from-grape-100 via-cream-50 to-grape-200',
        badge: 'bg-grape-500 text-white',
        chip: 'bg-grape-100 text-grape-700',
        soft: 'bg-grape-100/80',
        text: 'text-grape-700',
        border: 'border-grape-400',
        ring: 'ring-grape-400',
    },
};

export function themeOf(color?: string | null): ScenarioTheme {
    return scenarioTheme[color ?? ''] ?? scenarioTheme.sun;
}
