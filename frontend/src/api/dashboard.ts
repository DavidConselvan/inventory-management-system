import { useQuery } from '@tanstack/react-query';

import { api } from './client';
import type { Dashboard } from './types';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<Dashboard>('/dashboard/')).data,
  });
}
