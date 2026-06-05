import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Financials, Paginated, Product } from './types';

const LIST_PARAMS = { params: { page_size: 200, ordering: 'name' } };

export const productKeys = {
  all: ['products'] as const,
  financials: (id: number) => ['products', id, 'financials'] as const,
};

export type ProductInput = Pick<Product, 'name' | 'description' | 'sku' | 'unit'>;

export function useProducts() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: async () =>
      (await api.get<Paginated<Product>>('/products/', LIST_PARAMS)).data.results,
  });
}

export function useProductFinancials(id: number, enabled = true) {
  return useQuery({
    queryKey: productKeys.financials(id),
    enabled,
    queryFn: async () =>
      (await api.get<Financials>(`/products/${id}/financials/`)).data,
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ProductInput & { id?: number }) => {
      if (id) return (await api.put<Product>(`/products/${id}/`, input)).data;
      return (await api.post<Product>('/products/', input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/products/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
