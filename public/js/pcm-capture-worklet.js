/**
 * Let's Talk 麦克风采集 AudioWorklet（纯 JS，供浏览器直接加载）。
 * 把输入降混为单声道、转 Int16，每 4096 帧一批 postMessage 给主线程（transferable）。
 * 主线程在 resources/js/lib/audio/recorder.ts 中接收并重采样到 16kHz。
 */
class PcmCaptureWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buf = new Int16Array(4096);
        this.offset = 0;
    }

    process(inputs) {
        const input = inputs[0];

        if (input && input.length > 0) {
            const frameCount = input[0].length;

            for (let i = 0; i < frameCount; i++) {
                let sum = 0;
                for (let c = 0; c < input.length; c++) {
                    sum += input[c][i];
                }

                const s = Math.max(-1, Math.min(1, sum / input.length));
                this.buf[this.offset++] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);

                if (this.offset === this.buf.length) {
                    this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
                    this.buf = new Int16Array(4096);
                    this.offset = 0;
                }
            }
        }

        return true;
    }
}

registerProcessor('pcm-capture', PcmCaptureWorklet);
