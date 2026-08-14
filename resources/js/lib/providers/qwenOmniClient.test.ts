import { describe, expect, it } from 'vitest';
import {
    appendAudio,
    decodeAudio,
    isAiAudioDelta,
    isResponseDone,
    isSessionCreated,
    isSpeechStopped,
    normalizeEvent,
    sessionUpdate,
} from './qwenOmniClient';

describe('qwenOmniClient 协议适配', () => {
    it('session.update 注入 instructions 且带 event_id', () => {
        const preset = {
            session: {
                voice: 'Cherry',
                instructions: null,
                turn_detection: { type: 'server_vad' },
            },
        };
        const message = JSON.parse(sessionUpdate(preset, 'You are a tutor.'));

        expect(message.type).toBe('session.update');
        expect(message.event_id).toMatch(/^evt_/);
        expect(message.session.instructions).toBe('You are a tutor.');
        expect(message.session.voice).toBe('Cherry');
        expect(message.session.turn_detection.type).toBe('server_vad');
    });

    it('appendAudio 将 PCM base64 编码进 input_audio_buffer.append', () => {
        const pcm = new Int16Array([0, 1, -1, 256]);
        const message = JSON.parse(appendAudio(pcm));

        expect(message.type).toBe('input_audio_buffer.append');
        expect(message.event_id).toMatch(/^evt_/);

        const decoded = atob(message.audio);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
        const roundtrip = new Int16Array(bytes.buffer);

        expect(roundtrip.length).toBe(4);
        expect(roundtrip[0]).toBe(0);
        expect(roundtrip[1]).toBe(1);
        expect(roundtrip[2]).toBe(-1);
        expect(roundtrip[3]).toBe(256);
    });

    it('decodeAudio 读取 delta 字段（24kHz PCM base64）', () => {
        const pcm = new Int16Array([100, -200]);
        const bytes = new Uint8Array(pcm.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

        const event = { type: 'response.audio.delta', delta: btoa(binary) };
        const decoded = decodeAudio(event);

        expect(decoded).not.toBeNull();
        expect(decoded![0]).toBe(100);
        expect(decoded![1]).toBe(-200);
    });

    it('无 delta 字段返回 null（字段名错误会被暴露）', () => {
        expect(decodeAudio({ type: 'response.audio.delta', audio: 'xxx' })).toBeNull();
    });

    it('学生转写事件规范化', () => {
        const event = {
            type: 'conversation.item.input_audio_transcription.completed',
            item_id: 'item_1',
            transcript: ' Hello! ',
        };
        expect(normalizeEvent(event)).toEqual({
            speaker: 'student',
            kind: 'transcript',
            text: 'Hello!',
        });
    });

    it('AI 转写事件规范化', () => {
        const event = { type: 'response.audio_transcript.done', transcript: 'Hi there!' };
        expect(normalizeEvent(event)?.speaker).toBe('assistant');
    });

    it('无关事件返回 null', () => {
        expect(normalizeEvent({ type: 'session.created' })).toBeNull();
    });

    it('事件类型判断', () => {
        expect(isSessionCreated({ type: 'session.created' })).toBe(true);
        expect(isSpeechStopped({ type: 'input_audio_buffer.speech_stopped' })).toBe(true);
        expect(isAiAudioDelta({ type: 'response.audio.delta' })).toBe(true);
        expect(isResponseDone({ type: 'response.done' })).toBe(true);
    });
});
