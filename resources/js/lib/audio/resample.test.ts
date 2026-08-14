import { describe, expect, it } from 'vitest';
import { resampleLinear } from './resample';

describe('resampleLinear', () => {
    it('同采样率原样返回', () => {
        const input = new Int16Array([1, 2, 3, 4]);
        expect(resampleLinear(input, 16000, 16000)).toBe(input);
    });

    it('降采样长度按比例缩小（48k→16k = 1/3）', () => {
        const input = new Int16Array(480);
        const output = resampleLinear(input, 48000, 16000);
        expect(output.length).toBe(160);
    });

    it('升采样长度按比例放大（16k→48k = 3 倍）', () => {
        const input = new Int16Array(160);
        const output = resampleLinear(input, 16000, 48000);
        expect(output.length).toBe(480);
    });

    it('恒定信号重采样后数值不变', () => {
        const input = new Int16Array(300).fill(1000);
        const output = resampleLinear(input, 48000, 16000);
        expect(output.length).toBe(100);
        for (const sample of output) {
            expect(sample).toBe(1000);
        }
    });

    it('3 倍降采样按位置取源样本', () => {
        // 48k→16k：ratio=3，输出位置 0→源位置 0（100），位置 1→源位置 3（300）
        const input = new Int16Array([100, 300, 100, 300, 100, 300, 100, 300]);
        const output = resampleLinear(input, 48000, 16000);
        expect(output.length).toBe(2);
        expect(output[0]).toBe(100);
        expect(output[1]).toBe(300);
    });

    it('空输入不崩溃', () => {
        expect(resampleLinear(new Int16Array(0), 48000, 16000).length).toBe(0);
    });
});
