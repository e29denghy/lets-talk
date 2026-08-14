import { describe, expect, it } from 'vitest';
import { EnergyVad } from './vad';

function frames(amplitude: number, length = 1600): Int16Array {
    const pcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
        pcm[i] = Math.round(amplitude * 32768);
    }
    return pcm;
}

describe('EnergyVad', () => {
    it('低于阈值的静音不算说话', () => {
        const vad = new EnergyVad({ threshold: 0.02, hangoverMs: 400 });
        expect(vad.process(frames(0), 0)).toBe(false);
    });

    it('高于阈值的语音进入说话状态', () => {
        const vad = new EnergyVad({ threshold: 0.02, hangoverMs: 400 });
        expect(vad.process(frames(0.3), 100)).toBe(true);
        expect(vad.isActive).toBe(true);
    });

    it('语音结束后在 hangover 内仍算说话', () => {
        const vad = new EnergyVad({ threshold: 0.02, hangoverMs: 400 });
        expect(vad.process(frames(0.3), 100)).toBe(true);
        expect(vad.process(frames(0), 300)).toBe(true); // 200ms < 400ms hangover
    });

    it('超过 hangover 后回到静音', () => {
        const vad = new EnergyVad({ threshold: 0.02, hangoverMs: 400 });
        expect(vad.process(frames(0.3), 100)).toBe(true);
        expect(vad.process(frames(0), 600)).toBe(false);
        expect(vad.isActive).toBe(false);
    });

    it('hangover 内的再次发声延续状态', () => {
        const vad = new EnergyVad({ threshold: 0.02, hangoverMs: 400 });
        vad.process(frames(0.3), 100);
        vad.process(frames(0), 300);
        expect(vad.process(frames(0.3), 500)).toBe(true);
    });
});
