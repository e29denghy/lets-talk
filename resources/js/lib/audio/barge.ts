/**
 * 回声自适应的本地打断（barge-in）检测器。
 *
 * 背景：AI 说话时扬声器声音会漏进麦克风（回声）。旧实现用固定阈值 0.08 RMS，
 * 任何一帧超阈值即打断——回声稍大就误截断 AI 语音。
 *
 * 本检测器：
 * 1. 阈值自适应：低于阈值的帧被认为是「回声/底噪」，用于采样回声比
 *    （micRms / aiRms），阈值 = max(基础阈值, 回声比 × AI 能量 × 1.6 + 0.02)。
 *    回声永远不会超过「回声比 × AI 能量」，而真实人声会显著超过。
 * 2. 起始保守：回声比初始化为 0.9（上限），首句话绝不会因回声误触，
 *    随后随采样收敛到真实值。
 * 3. 连续确认：需连续 N 帧（默认 6 帧 ≈ 120ms）超阈值才确认打断，
 *    过滤咳嗽、拍桌等瞬时噪声。
 */
export interface BargeOptions {
    /** 无回声参考时的基础 RMS 阈值 */
    baseRms?: number;
    /** 确认打断所需的连续超阈帧数（每帧约 20ms） */
    confirmFrames?: number;
    /** 回声比估计下限（防真实人声被误采为回声） */
    ratioFloor?: number;
    /** 回声比估计上限（防麦克风饱和） */
    ratioCeil?: number;
    /** 阈值裕量：阈值 = max(base, ratio × aiRms × margin + 0.02) */
    margin?: number;
}

export class BargeDetector {
    private readonly baseRms: number;
    private readonly confirmFrames: number;
    private readonly ratioFloor: number;
    private readonly ratioCeil: number;
    private readonly margin: number;

    /** 回声比估计（micRms / aiRms），初始为上限=最保守 */
    private ratio: number;
    private samples: number[] = [];
    private loudRun = 0;

    constructor(opts: BargeOptions = {}) {
        this.baseRms = opts.baseRms ?? 0.08;
        this.confirmFrames = opts.confirmFrames ?? 6;
        this.ratioFloor = opts.ratioFloor ?? 0.08;
        this.ratioCeil = opts.ratioCeil ?? 0.9;
        this.margin = opts.margin ?? 1.6;
        this.ratio = this.ratioCeil;
    }

    /** 新一轮 AI 回复开始时调用，重置连续计数（回声比估计跨轮保留）。 */
    reset(): void {
        this.loudRun = 0;
    }

    /**
     * 每个麦克风帧（约 20ms）调用一次。
     * @param micRms 麦克风帧能量（rmsEnergy 输出）
     * @param aiRms AI 最近输出能量（无输出时为 0）
     * @returns 是否确认打断
     */
    update(micRms: number, aiRms: number): boolean {
        const threshold = Math.max(this.baseRms, this.ratio * aiRms * this.margin + 0.02);

        if (micRms < threshold) {
            this.loudRun = 0;

            // 阈值之下的帧视为回声/底噪：采样回声比（仅 AI 有输出时采样有效）
            if (aiRms > 0.03 && micRms > 0.005) {
                this.samples.push(micRms / aiRms);
                if (this.samples.length > 40) this.samples.shift();

                const sorted = [...this.samples].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];
                this.ratio = Math.min(this.ratioCeil, Math.max(this.ratioFloor, median));
            }

            return false;
        }

        this.loudRun += 1;
        return this.loudRun >= this.confirmFrames;
    }

    /** 当前自适应阈值（诊断用）。 */
    threshold(aiRms: number): number {
        return Math.max(this.baseRms, this.ratio * aiRms * this.margin + 0.02);
    }

    /** 当前回声比估计（诊断用）。 */
    echoRatio(): number {
        return this.ratio;
    }
}
