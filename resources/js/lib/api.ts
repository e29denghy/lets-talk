export interface Visitor {
    uuid: string;
    nickname: string | null;
    grade: number | null;
}

export interface Scenario {
    id: number;
    name: string;
    slug: string;
    level: number;
    description: string | null;
    target_vocab: string[];
}

export interface SessionCredentials {
    provider: string;
    ws_url: string;
    token: string;
    expires_at: number | null;
    model?: string;
    voice?: string;
    language?: string;
    sample_rate?: number;
    output_sample_rate?: number;
    session_init?: Record<string, unknown>;
}

export interface SessionStartResponse {
    session: { id: number; status: string; started_at: string | null };
    credentials: SessionCredentials;
    system_prompt: string;
    voice_config: Record<string, unknown>;
    audio: { sample_rate: number; chunk_interval_seconds: number; max_chunk_bytes: number };
    quota: { used_seconds: number; limit_seconds: number };
}

export interface TurnInput {
    seq: number;
    speaker: 'student' | 'assistant';
    text: string;
    start_ms?: number;
    end_ms?: number;
    latency_ms?: number;
}

export class ApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { credentials: 'same-origin', ...init });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message = (data && typeof data.message === 'string') ? data.message : `HTTP ${response.status}`;
        throw new ApiError(message, response.status);
    }

    return data as T;
}

export const api = {
    registerVisitor: (payload: { nickname?: string; grade?: number }) =>
        request<{ visitor: Visitor }>('/api/voice/visitors', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(payload),
        }),

    scenarios: () => request<{ scenarios: Scenario[] }>('/api/voice/scenarios'),

    startSession: (scenarioId: number) =>
        request<SessionStartResponse>('/api/voice/sessions', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ scenario_id: scenarioId }),
        }),

    uploadChunk: (sessionId: number, channel: 'student' | 'ai', seq: number, blob: Blob) =>
        fetch(`/api/voice/sessions/${sessionId}/audio/${channel}?seq=${seq}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: blob,
            credentials: 'same-origin',
        }),

    saveTurns: (sessionId: number, turns: TurnInput[]) =>
        request<{ stored: number }>(`/api/voice/sessions/${sessionId}/turns`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ turns }),
        }),

    endSession: (sessionId: number, timeline: unknown[]) =>
        request<{
            session: { id: number; status: string; duration_s: number; turn_count: number };
            quota: { used_seconds: number; limit_seconds: number };
        }>(`/api/voice/sessions/${sessionId}/end`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ timeline }),
        }),
};
