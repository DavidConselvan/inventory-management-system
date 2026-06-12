import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './client';

export type Entity = 'products' | 'stock' | 'purchase-orders' | 'sales-orders';

export interface ImportResult {
  entity: Entity;
  mapping: Record<string, string | null>;
  row_count: number;
  errors: Array<Record<string, unknown>>;
  created: number;
  would_create: number | null;
  preview: Array<Record<string, string>> | null;
}

async function downloadCsv(path: string, filename: string) {
  const resp = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(resp.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportCsv = (entity: Entity) => downloadCsv(`/export/${entity}/`, `${entity}.csv`);
export const downloadTemplate = (entity: Entity) =>
  downloadCsv(`/import/${entity}/template/`, `${entity}-template.csv`);

async function importCsv(entity: Entity, file: File, dryRun: boolean): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('dry_run', String(dryRun));
  return (await api.post<ImportResult>(`/import/${entity}/`, form)).data;
}

export function useImportPreview() {
  return useMutation({
    mutationFn: ({ entity, file }: { entity: Entity; file: File }) =>
      importCsv(entity, file, true),
  });
}

export function useImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entity, file }: { entity: Entity; file: File }) =>
      importCsv(entity, file, false),
    onSuccess: () => {
      // Imports can touch any entity's data and the dashboard.
      ['products', 'stock-lots', 'purchase-orders', 'sales-orders', 'dashboard'].forEach(
        (key) => qc.invalidateQueries({ queryKey: [key] }),
      );
    },
  });
}
