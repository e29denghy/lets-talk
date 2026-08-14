import { describe, expect, it } from 'vitest';
import { BargeDetector } from './barge';

describe('BargeDetector', () => {
    it('纯回声不误触：AI 0.3 能量下麦克风始终为 50% 回声', () => {
        const d = new BargeDetector();
        let barge = false;
        for (let i = 0; i < 100; i++) {
            if (d.update(0.15, 0.3)) barge = true;
        }
        expect(barge).toBe(false);
    });

    it('起始保守：首句话高回声比 0.9 也不触发', () => {
        const d = new BargeDetector();
        let barge = false;
        for (let i = 0; i < 30; i++) {
            if (d.update(0.27, 0.3)) barge = true;
        }
        expect(barge).toBe(false);
    });

    it('学生盖过 AI：回声之上持续说话 6 帧确认打断', () => {
        const d = new BargeDetector();
        // 先喂 50 帧纯回声让回声比收敛到 0.5
        for (let i = 0; i < 50; i++) d.update(0.15, 0.3);

        let bargeAt = -1;
        for (let i = 0; i < 10; i++) {
            if (d.update(0.45, 0.3)) {
                bargeAt = i;
                break;
            }
        }
        // 0.15 回声 + 0.3 人声 = 0.45 > 阈值(0.5×0.3×1.6+0.02=0.26)
        expect(bargeAt).toBeGreaterThanOrEqual(5);
    });

    it('瞬时噪声不触发：2 帧高能量后回落', () => {
        const d = new BargeDetector();
        for (let i = 0; i < 50; i++) d.update(0.05, 0.2);
        expect(d.update(0.5, 0.2)).toBe(false);
        expect(d.update(0.5, 0.2)).toBe(false);
        // 回落重置计数
        expect(d.update(0.05, 0.2)).toBe(false);
        for (let i = 0; i < 5; i++) expect(d.update(0.5, 0.2)).toBe(false);
        // 再持续一帧确认
        expect(d.update(0.5, 0.2)).toBe(true);
    });

    it('AI 静默（句子间停顿）时基础阈值生效：正常语音 6 帧触发', () => {
        const d = new BargeDetector();
        let barge = false;
        for (let i = 0; i < 6; i++) {
            if (d.update(0.15, 0)) barge = true;
        }
        expect(barge).toBe(true);
    });

    it('回声比不会把真实人声采进样本（超阈帧不采样）', () => {
        const d = new BargeDetector();
        for (let i = 0; i < 40; i++) d.update(0.1, 0.25); // 回声比 0.4 收敛
        expect(d.echoRatio()).toBeCloseTo(0.4, 1);
        // 持续超阈的人声不应拉高回声比
        for (let i = 0; i < 6; i++) d.update(0.5, 0.25);
        expect(d.echoRatio()).toBeCloseTo(0.4, 1);
    });
});
