/**
 * AI 音频播放器：接收 16kHz mono Int16 PCM 帧，双缓冲排程到 AudioContext。
 * 支持 flush() 打断（barge-in）：40ms 淡出后停止，避免硬切爆音。
 */
export class PcmPlayer {
    private ctx: AudioContext | null = null;
    private gain: GainNode | null = null;
    private queue: Int16Array[] = [];
    private sources: AudioBufferSourceNode[] = [];
    private scheduledUntil = 0;
    private sampleRate = 16000;
    private flushGen = 0;

    get isReady(): boolean {
        return this.ctx !== null;
    }

    /** 必须在用户手势（点击开始按钮）中调用，解锁浏览器自动播放策略。 */
    async unlock(sampleRate = 16000): Promise<void> {
        this.sampleRate = sampleRate;

        if (!this.ctx) {
            this.ctx = new AudioContext();
            this.gain = this.ctx.createGain();
            this.gain.connect(this.ctx.destination);
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
        if (!this.ctx || !this.gain) return;

        const chunk = this.queue.shift();
        if (!chunk) return;

        const now = this.ctx.currentTime;

        // 新话轮开头：确保增益恢复为 1（上次打断的淡出可能仍在进行）
        if (this.sources.length === 0) {
            this.gain.gain.cancelScheduledValues(now);
            this.gain.gain.setValueAtTime(1, now);
        }

        const buffer = this.ctx.createBuffer(1, chunk.length, this.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < chunk.length; i++) {
            data[i] = chunk[i] / 32768;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gain);

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

    /** 打断：清空待播队列，40ms 淡出后停止已排程音源（防爆音）。 */
    flush(): void {
        const gen = ++this.flushGen;
        this.queue.length = 0;

        if (!this.ctx || !this.gain) return;

        const ctx = this.ctx;
        const gain = this.gain;
        const now = ctx.currentTime;

        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.04);

        window.setTimeout(() => {
            // 只有未被新话轮覆盖时才停止音源
            if (gen === this.flushGen) {
                for (const source of this.sources) {
                    source.onended = null;
                    try {
                        source.stop();
                    } catch {
                        // 已停止，忽略
                    }
                }
                this.sources.length = 0;
                this.scheduledUntil = ctx.currentTime;
            }

            // 无论如何恢复增益，交给下一次 pump 的新话轮起点使用
            gain.gain.cancelScheduledValues(ctx.currentTime);
            gain.gain.setValueAtTime(1, ctx.currentTime);
        }, 60);
    }

    close(): void {
        this.flushGen += 1;
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
        void this.ctx?.close().catch(() => undefined);
        this.ctx = null;
        this.gain = null;
    }
}
