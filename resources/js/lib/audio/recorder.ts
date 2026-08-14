import { resampleLinear } from './resample';

export interface RecorderOptions {
    /** 目标采样率，默认 16000（16kHz mono 为语音服务标准输入）。 */
    targetSampleRate?: number;
    /** 每批 PCM（已重采样为目标采样率）回调。 */
    onPcm: (pcm: Int16Array, sampleRate: number) => void;
}

/**
 * 麦克风采集器：getUserMedia + AudioWorklet 降混转 Int16，
 * 主线程重采样到目标采样率后回调。
 */
export class MicRecorder {
    private ctx: AudioContext | null = null;
    private stream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private node: AudioWorkletNode | null = null;
    private started = false;

    constructor(private options: RecorderOptions) {}

    get isStarted(): boolean {
        return this.started;
    }

    async start(): Promise<void> {
        if (this.started) return;

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        this.ctx = new AudioContext();
        await this.ctx.audioWorklet.addModule(new URL('../../workers/pcm-worklet.ts', import.meta.url));

        this.source = this.ctx.createMediaStreamSource(this.stream);
        this.node = new AudioWorkletNode(this.ctx, 'pcm-capture');

        const targetRate = this.options.targetSampleRate ?? 16000;

        this.node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            const frames = new Int16Array(event.data);
            const pcm = this.ctx && this.ctx.sampleRate !== targetRate
                ? resampleLinear(frames, this.ctx.sampleRate, targetRate)
                : frames;
            this.options.onPcm(pcm, targetRate);
        };

        this.source.connect(this.node);
        await this.ctx.resume();
        this.started = true;
    }

    async stop(): Promise<void> {
        this.started = false;
        this.node?.port.close();
        this.node?.disconnect();
        this.source?.disconnect();
        this.stream?.getTracks().forEach((track) => track.stop());

        if (this.ctx && this.ctx.state !== 'closed') {
            await this.ctx.close().catch(() => undefined);
        }

        this.node = null;
        this.source = null;
        this.stream = null;
        this.ctx = null;
    }
}
