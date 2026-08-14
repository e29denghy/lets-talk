import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChunkUploader } from './uploader';

function pcm(bytes: number[]): Int16Array {
    return Int16Array.from(bytes);
}

describe('ChunkUploader', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    let uploader: ChunkUploader;

    beforeEach(() => {
        vi.useFakeTimers();
        fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function makeUploader(maxBytes = 1000, intervalMs = 20000) {
        uploader = new ChunkUploader({
            buildUrl: (channel, seq) => `/api/voice/sessions/1/audio/${channel}?seq=${seq}`,
            intervalMs,
            maxBytes,
        });
        return uploader;
    }

    it('缓冲达到上限立即上传并递增 seq', async () => {
        makeUploader(8);
        await uploader.append('student', pcm([1, 2, 3, 4, 5])); // 10 字节 ≥ 8

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toContain('/audio/student?seq=0');

        await uploader.append('student', pcm([1, 2, 3, 4, 5]));
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toContain('/audio/student?seq=1');
    });

    it('双通道 seq 独立', async () => {
        makeUploader(4);
        await uploader.append('student', pcm([1, 2]));
        await uploader.append('ai', pcm([1, 2]));

        expect(fetchMock.mock.calls[0][0]).toContain('/audio/student?seq=0');
        expect(fetchMock.mock.calls[1][0]).toContain('/audio/ai?seq=0');
    });

    it('定时器触发冲刷（未达上限也上传）', async () => {
        makeUploader(10000, 20000);
        await uploader.append('student', pcm([1, 2]));

        expect(fetchMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(20000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('上传失败用同一 seq 重试（服务端幂等）', async () => {
        makeUploader(4, 20000);

        fetchMock.mockRejectedValueOnce(new Error('network'));
        await uploader.append('student', pcm([1, 2]));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toContain('seq=0');

        // 重试成功后，下一次上传才是 seq=1
        await vi.advanceTimersByTimeAsync(20000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toContain('seq=0');

        await uploader.append('student', pcm([1, 2]));
        expect(fetchMock.mock.calls[2][0]).toContain('seq=1');
    });

    it('destroy 清除定时器', () => {
        const clearSpy = vi.spyOn(window, 'clearInterval');
        makeUploader();
        uploader.destroy();
        expect(clearSpy).toHaveBeenCalled();
    });
});
