/**
 * 简单能量 VAD：RMS 能量阈值 + 静音悬挂（hangover）。
 * 用于：1) 学生说话的起止判定（决定何时 commit 一句话）；
 *      2) AI 播放期间检测学生开口 → 触发打断。
 */
export interface VadOptions {
    threshold?: number;
    hangoverMs?: number;
}

/** 计算 16-bit PCM 的 RMS 能量（0~1）。 */
export function rmsEnergy(pcm: Int16Array): number {
    let sum = 0;

    for (let i = 0; i < pcm.length; i++) {
        const s = pcm[i] / 32768;
        sum += s * s;
    }

    return Math.sqrt(sum / Math.max(1, pcm.length));
}

export class EnergyVad {
    private readonly threshold: number;
    private readonly hangoverMs: number;
    private lastActiveAt = -Infinity;
    private active = false;

    constructor(options: VadOptions = {}) {
        this.threshold = options.threshold ?? 0.02;
        this.hangoverMs = options.hangoverMs ?? 450;
    }

    /** 输入 16kHz mono PCM，返回该帧是否属于「说话」状态。 */
    process(pcm: Int16Array, nowMs: number = performance.now()): boolean {
        const energy = rmsEnergy(pcm);

        if (energy >= this.threshold) {
            this.lastActiveAt = nowMs;
            this.active = true;
            return true;
        }

        if (this.active && nowMs - this.lastActiveAt > this.hangoverMs) {
            this.active = false;
        }

        return this.active;
    }

    get isActive(): boolean {
        return this.active;
    }
}
