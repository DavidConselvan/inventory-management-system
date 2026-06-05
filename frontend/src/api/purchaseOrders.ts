import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Paginated, PurchaseOrder } from './types';

const LIST_PARAMS = { params: { page_size: 200, ordering: '-order_date' } };

export const purchaseOrderKeys = { all: ['purchase-orders'] as const };

export interface PurchaseOrderInput {
  reference?: string;
  supplier?: string;
  order_date: string;
  notes?: string;
  items: { product: number; quantity: string; unit_cost: string }[];
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: purchaseOrderKeys.all,
    queryFn: async () =>
      (await api.get<Paginated<PurchaseOrder>>('/purchase-orders/', LIST_PARAMS)).data
        .results,
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PurchaseOrderInput) =>
      (await api.post<PurchaseOrder>('/purchase-orders/', input)).data,
    onSuccess: () => {
      // Receiving stock changes lots, product financials and the dashboard.
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      qc.invalidateQueries({ queryKey: ['stock-lots'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/purchase-orders/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseOrderKeys.all }),
  });
}
