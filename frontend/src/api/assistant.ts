import { useMutation } from '@tanstack/react-query';

import { api, authorizedFetch } from './client';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Non-streaming reply (kept as a fallback / for simple callers). */
export function useAssistant() {
  return useMutation({
    mutationFn: async ({ message, history }: { message: string; history: ChatTurn[] }) =>
      (await api.post<{ reply: string }>('/assistant/', { message, history })).data.reply,
  });
}

interface StreamHandlers {
  /** Called with the full accumulated answer text on every token. */
  onText: (fullText: string) => void;
  /** Called once with suggested follow-up questions, if any. */
  onFollowups?: (questions: string[]) => void;
}

/**
 * Stream JP's reply via Server-Sent Events. Resolves once the stream closes;
 * rejects on transport or backend errors.
 */
export async function streamAssistant(
  message: string,
  history: ChatTurn[],
  handlers: StreamHandlers,
): Promise<void> {
  const res = await authorizedFetch('/assistant/stream/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Assistant request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep the trailing partial line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;

      const event = JSON.parse(payload) as
        | { type: 'text'; text: string }
        | { type: 'followups'; items: string[] }
        | { type: 'error'; detail: string }
        | { type: 'done' };

      if (event.type === 'text') {
        text += event.text;
        handlers.onText(text);
      } else if (event.type === 'followups') {
        handlers.onFollowups?.(event.items);
      } else if (event.type === 'error') {
        throw new Error(event.detail || 'Assistant error');
      }
    }
  }
}
