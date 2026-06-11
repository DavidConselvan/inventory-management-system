import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Paginated, SalesOrder } from './types';

const LIST_PARAMS = { params: { page_size: 200, ordering: '-order_date' } };

export const salesOrderKeys = {
  all: ['sales-orders'] as const,
  detail: (id: number) => ['sales-orders', id] as const,
};

export interface SalesOrderInput {
  reference?: string;
  customer?: string;
  order_date: string;
  status?: string;
  notes?: string;
  items: { product: number; quantity: string; unit_price: string }[];
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  // A sale consumes stock and realises profit, so refresh stock and dashboards too.
  qc.invalidateQueries({ queryKey: salesOrderKeys.all });
  qc.invalidateQueries({ queryKey: ['stock-lots'] });
  qc.invalidateQueries({ queryKey: ['products'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useSalesOrders() {
  return useQuery({
    queryKey: salesOrderKeys.all,
    queryFn: async () =>
      (await api.get<Paginated<SalesOrder>>('/sales-orders/', LIST_PARAMS)).data.results,
  });
}

export function useSalesOrder(id: number) {
  return useQuery({
    queryKey: salesOrderKeys.detail(id),
    queryFn: async () => (await api.get<SalesOrder>(`/sales-orders/${id}/`)).data,
  });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalesOrderInput) =>
      (await api.post<SalesOrder>('/sales-orders/', input)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: SalesOrderInput & { id: number }) =>
      (await api.put<SalesOrder>(`/sales-orders/${id}/`, input)).data,
    onSuccess: (data) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: salesOrderKeys.detail(data.id) });
    },
  });
}

export function useDeleteSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/sales-orders/${id}/`),
    onSuccess: () => invalidate(qc),
  });
}
