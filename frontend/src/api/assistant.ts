import { useMutation } from '@tanstack/react-query';

import { api } from './client';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function useAssistant() {
  return useMutation({
    mutationFn: async ({ message, history }: { message: string; history: ChatTurn[] }) =>
      (await api.post<{ reply: string }>('/assistant/', { message, history })).data.reply,
  });
}
