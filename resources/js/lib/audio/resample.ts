/** 线性插值重采样（Int16 mono）。 */
export function resampleLinear(input: Int16Array, fromRate: number, toRate: number): Int16Array {
    if (fromRate === toRate) return input;

    const ratio = fromRate / toRate;
    const length = Math.max(1, Math.floor(input.length / ratio));
    const output = new Int16Array(length);

    for (let i = 0; i < length; i++) {
        const position = i * ratio;
        const i0 = Math.floor(position);
        const fraction = position - i0;
        const i1 = Math.min(i0 + 1, input.length - 1);
        output[i] = Math.round(input[i0] + (input[i1] - input[i0]) * fraction);
    }

    return output;
}
