import { ActionIcon, Badge, Card, Group, Select, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconChevronRight, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useDeleteProduct, useProductList } from '../api/products';
import type { Product } from '../api/types';
import { DataActions } from '../components/DataActions';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ProductFormModal } from '../components/ProductFormModal';
import { QueryBoundary } from '../components/QueryBoundary';
import { confirmDelete } from '../lib/confirm';
import { useListControls } from '../lib/useListControls';

const UNIT_OPTIONS = [
  { value: '', label: 'All units' },
  { value: 'UNIT', label: 'unit' },
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'L', label: 'l' },
  { value: 'ML', label: 'ml' },
];

export function ProductsPage() {
  const [unit, setUnit] = useState('');
  const controls = useListControls({ ordering: 'name', filters: { unit } });
  const products = useProductList(controls.params);
  const remove = useDeleteProduct();
  const navigate = useNavigate();
  const [modalOpened, modal] = useDisclosure(false);

  const onDelete = (product: Product) =>
    confirmDelete({
      title: 'Delete product',
      message: `"${product.name}" will be removed. Products referenced by orders or stock can't be deleted.`,
      onConfirm: async () => {
        try {
          await remove.mutateAsync(product.id);
          notifications.show({ color: 'green', message: 'Product deleted' });
        } catch (err) {
          notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
        }
      },
    });

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Name',
      sortField: 'name',
      render: (p) => (
        <div>
          <Text fw={500}>{p.name}</Text>
          {p.description && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {p.description}
            </Text>
          )}
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', sortField: 'sku', render: (p) => <Badge variant="default">{p.sku}</Badge> },
    { key: 'unit', header: 'Unit', sortField: 'unit', render: (p) => p.unit.toLowerCase() },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sortable: false,
      render: (p) => (
        <Group gap={4} justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <Tooltip label="Delete">
            <ActionIcon variant="subtle" color="red" onClick={() => onDelete(p)}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
          <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        subtitle="Your catalog — click a product to view its stock and financials"
        actionLabel="New product"
        onAction={modal.open}
      >
        <DataActions entity="products" label="Products" />
      </PageHeader>

      <Card withBorder radius="md" p="md">
        <QueryBoundary isLoading={products.isLoading} isError={products.isError} error={products.error}>
          <DataTable
            data={products.data?.results ?? []}
            columns={columns}
            getRowKey={(p) => p.id}
            searchPlaceholder="Search products…"
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            emptyMessage="No products match. Adjust your search or filter."
            server={{
              search: controls.search,
              onSearch: controls.setSearch,
              ordering: controls.ordering,
              onOrder: controls.onOrder,
              page: controls.page,
              onPage: controls.setPage,
              total: products.data?.count ?? 0,
              pageSize: controls.pageSize,
              loading: products.isFetching,
            }}
            filters={
              <Select
                data={UNIT_OPTIONS}
                value={unit}
                onChange={(v) => setUnit(v ?? '')}
                aria-label="Filter by unit"
                w={150}
                allowDeselect={false}
              />
            }
          />
        </QueryBoundary>
      </Card>

      <ProductFormModal opened={modalOpened} onClose={modal.close} />
    </>
  );
}
