import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Paginated, SalesOrder } from './types';

const LIST_PARAMS = { params: { page_size: 200, ordering: '-order_date' } };

export const salesOrderKeys = { all: ['sales-orders'] as const };

export interface SalesOrderInput {
  reference?: string;
  customer?: string;
  order_date: string;
  notes?: string;
  items: { product: number; quantity: string; unit_price: string }[];
}

export function useSalesOrders() {
  return useQuery({
    queryKey: salesOrderKeys.all,
    queryFn: async () =>
      (await api.get<Paginated<SalesOrder>>('/sales-orders/', LIST_PARAMS)).data.results,
  });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalesOrderInput) =>
      (await api.post<SalesOrder>('/sales-orders/', input)).data,
    onSuccess: () => {
      // A sale consumes stock and realises profit.
      qc.invalidateQueries({ queryKey: salesOrderKeys.all });
      qc.invalidateQueries({ queryKey: ['stock-lots'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/sales-orders/${id}/`),
    onSuccess: () => {
      // Deleting a sale restores stock to its lots.
      qc.invalidateQueries({ queryKey: salesOrderKeys.all });
      qc.invalidateQueries({ queryKey: ['stock-lots'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
