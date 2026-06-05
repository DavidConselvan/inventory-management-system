import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Paginated, StockLot } from './types';

const LIST_PARAMS = { params: { page_size: 200, ordering: 'received_date' } };

export const stockLotKeys = { all: ['stock-lots'] as const };

export interface ManualStockInput {
  product: number;
  unit_cost: string;
  quantity_received: string;
  received_date?: string;
}

export function useStockLots() {
  return useQuery({
    queryKey: stockLotKeys.all,
    queryFn: async () =>
      (await api.get<Paginated<StockLot>>('/stock-lots/', LIST_PARAMS)).data.results,
  });
}

export function useAddStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualStockInput) =>
      (await api.post<StockLot>('/stock-lots/', input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockLotKeys.all });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
