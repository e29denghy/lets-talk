export type AudioChannel = 'student' | 'ai';

export interface UploaderOptions {
    /** 构造上传地址（channel + seq），seq 由上传器维护。 */
    buildUrl: (channel: AudioChannel, seq: number) => string;
    /** 定时冲刷间隔（毫秒）。 */
    intervalMs: number;
    /** 缓冲达到该字节数立即冲刷。 */
    maxBytes: number;
    onFlush?: (channel: AudioChannel, seq: number, bytes: number, ok: boolean) => void;
}

/**
 * 录音分片上传器：内存缓冲 → 定时/定量 POST 原始字节。
 * 失败重传沿用同一 seq（服务端按 (session, channel, seq) 幂等去重），不丢数据。
 */
export class ChunkUploader {
    private buffers: Record<AudioChannel, BlobPart[]> = { student: [], ai: [] };
    private sizes: Record<AudioChannel, number> = { student: 0, ai: 0 };
    private seqs: Record<AudioChannel, number> = { student: 0, ai: 0 };
    private inflight: Record<AudioChannel, boolean> = { student: false, ai: false };
    private timer: number | null = null;

    constructor(private options: UploaderOptions) {
        this.timer = window.setInterval(() => {
            void this.flush('student');
            void this.flush('ai');
        }, options.intervalMs);
    }

    append(channel: AudioChannel, pcm: Int16Array): void {
        // 完整拷贝，避免上游缓冲复用
        const copy = new Uint8Array(pcm.byteLength);
        copy.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));

        this.buffers[channel].push(copy);
        this.sizes[channel] += copy.byteLength;

        if (this.sizes[channel] >= this.options.maxBytes) {
            void this.flush(channel);
        }
    }

    async flush(channel: AudioChannel): Promise<void> {
        if (this.inflight[channel] || this.sizes[channel] === 0) return;

        this.inflight[channel] = true;

        const payload = new Blob(this.buffers[channel], { type: 'application/octet-stream' });
        const seq = this.seqs[channel];
        const size = this.sizes[channel];

        this.buffers[channel] = [];
        this.sizes[channel] = 0;

        try {
            const response = await fetch(this.options.buildUrl(channel, seq), {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: payload,
                credentials: 'same-origin',
            });

            if (!response.ok && response.status !== 409) {
                throw new Error(`HTTP ${response.status}`);
            }

            this.seqs[channel] += 1;
            this.options.onFlush?.(channel, seq, size, true);
        } catch {
            // 放回队首，下一轮重传（seq 不变 → 服务端幂等）
            this.buffers[channel].unshift(payload);
            this.sizes[channel] += size;
            this.options.onFlush?.(channel, seq, size, false);
        } finally {
            this.inflight[channel] = false;
        }
    }

    async flushAll(): Promise<void> {
        await Promise.all([this.flush('student'), this.flush('ai')]);
    }

    destroy(): void {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
    }
}
