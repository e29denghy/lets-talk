/**
 * Qwen3-Omni Realtime 客户端协议适配。
 * 事件名/字段与后端 App\Realtime\Providers\QwenOmniProvider 保持一致，
 * 以官方文档为准（https://help.aliyun.com/zh/model-studio/omni/），联调时核对。
 */

export interface QwenEvent {
    type: string;
    [key: string]: unknown;
}

/** 连接后第一条消息：会话配置（instructions 填入后端下发的 system_prompt）。 */
export function sessionInit(preset: Record<string, unknown>, systemPrompt: string): string {
    const session = { ...(preset.session as Record<string, unknown>), instructions: systemPrompt };
    return JSON.stringify({ type: 'session.update', session });
}

/** 追加学生音频（PCM 字节 base64）。 */
export function appendAudio(pcm: Int16Array): string {
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let binary = '';

    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }

    return JSON.stringify({ type: 'input_audio_buffer.append', audio: btoa(binary) });
}

/** 学生一句话结束：提交音频缓冲开始推理。 */
export function commitAudio(): string {
    return JSON.stringify({ type: 'input_audio_buffer.commit' });
}

/** 打断：取消当前生成。 */
export function cancelResponse(): string {
    return JSON.stringify({ type: 'response.cancel' });
}

/** 供应商事件 → 统一字幕结构（与后端 normalizeEvent 对应）。 */
export function normalizeEvent(event: QwenEvent): {
    speaker: 'student' | 'assistant';
    kind: 'transcript';
    text: string;
} | null {
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
        const text = typeof event.transcript === 'string' ? event.transcript.trim() : '';
        return text ? { speaker: 'student', kind: 'transcript', text } : null;
    }

    if (event.type === 'response.audio_transcript.done') {
        const text = typeof event.transcript === 'string' ? event.transcript.trim() : '';
        return text ? { speaker: 'assistant', kind: 'transcript', text } : null;
    }

    return null;
}

export function isAiAudioDelta(event: QwenEvent): boolean {
    return event.type === 'response.audio.delta';
}

export function isResponseDone(event: QwenEvent): boolean {
    return event.type === 'response.done';
}

export function isResponseCancelled(event: QwenEvent): boolean {
    return event.type === 'response.cancelled';
}

/** 解码 base64 PCM 为 Int16Array。 */
export function decodeAudio(event: QwenEvent): Int16Array | null {
    const audio = typeof event.audio === 'string' ? event.audio : null;
    if (!audio) return null;

    const binary = atob(audio);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Int16Array(bytes.buffer);
}
