import { tokens } from '../auth/tokens';
import { api } from './client';
import type { User } from './types';

export interface RegisterPayload {
  username: string;
  email?: string;
  password: string;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me/');
  return data;
}

export async function login(username: string, password: string): Promise<User> {
  const { data } = await api.post('/auth/token/', { username, password });
  tokens.setPair(data.access, data.refresh);
  return fetchMe();
}

export async function register(payload: RegisterPayload): Promise<void> {
  await api.post('/auth/register/', payload);
}
