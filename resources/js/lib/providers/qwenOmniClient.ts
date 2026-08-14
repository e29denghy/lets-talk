/**
 * Qwen-Omni Realtime 客户端协议适配。
 * 事件名/字段对齐官方实时多模态 API 文档（2026-07 版）：
 * https://help.aliyun.com/zh/model-studio/omni-realtime-api
 * 与后端 App\Realtime\Providers\QwenOmniProvider 保持一致。
 */

export interface QwenEvent {
    type: string;
    [key: string]: unknown;
}

function eventId(): string {
    return `evt_${crypto.randomUUID()}`;
}

/**
 * 收到 session.created 后发送的会话配置（instructions 填入后端下发的 system_prompt）。
 * turn_detection 使用 server_vad：自动话轮判断、说话结束自动提交、插话自动打断。
 */
export function sessionUpdate(preset: Record<string, unknown>, systemPrompt: string): string {
    const session = { ...(preset.session as Record<string, unknown>), instructions: systemPrompt };
    return JSON.stringify({ event_id: eventId(), type: 'session.update', session });
}

/** 追加学生音频（16kHz PCM 字节 base64，VAD 模式下持续发送即可）。 */
export function appendAudio(pcm: Int16Array): string {
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let binary = '';

    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }

    return JSON.stringify({
        event_id: eventId(),
        type: 'input_audio_buffer.append',
        audio: btoa(binary),
    });
}

/** 手动打断（server_vad 的 interrupt_response 会自动打断，仅在确需时用）。 */
export function cancelResponse(): string {
    return JSON.stringify({ event_id: eventId(), type: 'response.cancel' });
}

/** 连接后第一个服务端事件：默认会话配置。 */
export function isSessionCreated(event: QwenEvent): boolean {
    return event.type === 'session.created';
}

/** 服务端 VAD 检测到学生开始说话。 */
export function isSpeechStarted(event: QwenEvent): boolean {
    return event.type === 'input_audio_buffer.speech_started';
}

/** 服务端 VAD 检测到学生说完（其后开始推理）。 */
export function isSpeechStopped(event: QwenEvent): boolean {
    return event.type === 'input_audio_buffer.speech_stopped';
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

export interface TurnUsage {
    input_text_tokens: number;
    input_audio_tokens: number;
    output_text_tokens: number;
    output_audio_tokens: number;
}

/** 从 response.done 中提取 token 用量（用于成本核算）。 */
export function extractUsage(event: QwenEvent): TurnUsage | null {
    const usage = (event.response as { usage?: Record<string, unknown> } | undefined)?.usage;
    if (!usage) return null;

    const inputDetails = (usage.input_tokens_details ?? {}) as Record<string, unknown>;
    const outputDetails = (usage.output_tokens_details ?? {}) as Record<string, unknown>;

    const num = (value: unknown) => (typeof value === 'number' ? value : 0);

    return {
        input_text_tokens: num(inputDetails.text_tokens),
        input_audio_tokens: num(inputDetails.audio_tokens),
        output_text_tokens: num(outputDetails.text_tokens),
        output_audio_tokens: num(outputDetails.audio_tokens),
    };
}

export function isResponseCancelled(event: QwenEvent): boolean {
    return event.type === 'response.cancelled';
}

/** 解码 response.audio.delta 的 base64 PCM（字段名为 delta，24kHz）。 */
export function decodeAudio(event: QwenEvent): Int16Array | null {
    const audio = typeof event.delta === 'string' ? event.delta : null;
    if (!audio) return null;

    const binary = atob(audio);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Int16Array(bytes.buffer);
}
