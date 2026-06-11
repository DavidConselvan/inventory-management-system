import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Paginated, StockLot } from './types';

export const stockLotKeys = {
  all: ['stock-lots'] as const,
  list: (productId?: number) => ['stock-lots', { productId }] as const,
};

export interface ManualStockInput {
  product: number;
  unit_cost: string;
  quantity_received: string;
  received_date?: string;
}

function invalidateStock(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: stockLotKeys.all });
  qc.invalidateQueries({ queryKey: ['products'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useStockLots(productId?: number) {
  return useQuery({
    queryKey: stockLotKeys.list(productId),
    queryFn: async () =>
      (
        await api.get<Paginated<StockLot>>('/stock-lots/', {
          params: { page_size: 200, ordering: 'received_date', product: productId },
        })
      ).data.results,
  });
}

export function useAddStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualStockInput) =>
      (await api.post<StockLot>('/stock-lots/', input)).data,
    onSuccess: () => invalidateStock(qc),
  });
}

export function useUpdateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ManualStockInput & { id: number }) =>
      (await api.put<StockLot>(`/stock-lots/${id}/`, input)).data,
    onSuccess: () => invalidateStock(qc),
  });
}

export function useDeleteStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/stock-lots/${id}/`),
    onSuccess: () => invalidateStock(qc),
  });
}
