/**
 * AI 音频播放器：接收 16kHz mono Int16 PCM 帧，双缓冲排程到 AudioContext。
 * 支持 flush() 打断（barge-in）。
 */
export class PcmPlayer {
    private ctx: AudioContext | null = null;
    private queue: Int16Array[] = [];
    private sources: AudioBufferSourceNode[] = [];
    private scheduledUntil = 0;
    private sampleRate = 16000;

    get isReady(): boolean {
        return this.ctx !== null;
    }

    /** 必须在用户手势（点击开始按钮）中调用，解锁浏览器自动播放策略。 */
    async unlock(sampleRate = 16000): Promise<void> {
        this.sampleRate = sampleRate;

        if (!this.ctx) {
            this.ctx = new AudioContext();
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    push(pcm: Int16Array): void {
        if (!this.ctx || pcm.length === 0) return;

        // 拷贝一份，避免上游复用 ArrayBuffer 导致数据损坏
        this.queue.push(pcm.slice());
        this.pump();
    }

    private pump(): void {
        if (!this.ctx) return;

        const chunk = this.queue.shift();
        if (!chunk) return;

        const buffer = this.ctx.createBuffer(1, chunk.length, this.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < chunk.length; i++) {
            data[i] = chunk[i] / 32768;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);

        const now = this.ctx.currentTime;
        const startAt = Math.max(now + 0.02, this.scheduledUntil);
        source.start(startAt);
        this.scheduledUntil = startAt + buffer.duration;

        source.onended = () => {
            const index = this.sources.indexOf(source);
            if (index >= 0) this.sources.splice(index, 1);
            this.pump();
        };

        this.sources.push(source);
    }

    /** 打断：清空待播队列并立即停止已排程音源。 */
    flush(): void {
        this.queue.length = 0;

        for (const source of this.sources) {
            source.onended = null;
            try {
                source.stop();
            } catch {
                // 已停止，忽略
            }
        }

        this.sources.length = 0;
        this.scheduledUntil = this.ctx?.currentTime ?? 0;
    }

    close(): void {
        this.flush();
        void this.ctx?.close().catch(() => undefined);
        this.ctx = null;
    }
}
