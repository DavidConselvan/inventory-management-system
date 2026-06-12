import { ActionIcon, Anchor, Card, Group, Select, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import { useDeleteStock, useStockLotList } from '../api/stockLots';
import type { StockLot } from '../api/types';
import { DataActions } from '../components/DataActions';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { StockFormModal } from '../components/StockFormModal';
import { confirmDelete } from '../lib/confirm';
import { money, qty } from '../lib/format';
import { useListControls } from '../lib/useListControls';

export function StockPage() {
  const products = useProducts();
  const [product, setProduct] = useState<string>('');
  const controls = useListControls({ ordering: '-received_date', filters: { product } });
  const lots = useStockLotList(controls.params);
  const remove = useDeleteStock();
  const [opened, modal] = useDisclosure(false);
  const [editing, setEditing] = useState<StockLot | null>(null);

  const productOptions = [
    { value: '', label: 'All products' },
    ...(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const openAdd = () => {
    setEditing(null);
    modal.open();
  };
  const openEdit = (lot: StockLot) => {
    setEditing(lot);
    modal.open();
  };

  const onDelete = (lot: StockLot) =>
    confirmDelete({
      title: 'Delete stock lot',
      message: `Lot ${lot.lot_code} will be removed. A lot that has been sold from can't be deleted.`,
      onConfirm: async () => {
        try {
          await remove.mutateAsync(lot.id);
          notifications.show({ color: 'green', message: 'Stock lot deleted' });
        } catch (err) {
          notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
        }
      },
    });

  const columns: Column<StockLot>[] = [
    {
      key: 'lot_code',
      header: 'Lot',
      sortField: 'lot_code',
      render: (l) => (
        <div>
          <Text size="sm" ff="monospace">
            {l.lot_code}
          </Text>
          <Text size="xs" c={l.source_item ? 'blue' : 'dimmed'}>
            {l.source_item ? 'Purchase' : 'Manual'}
          </Text>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (l) => (
        <Anchor component={Link} to={`/products/${l.product}`} onClick={(e) => e.stopPropagation()}>
          {l.product_name}
        </Anchor>
      ),
    },
    { key: 'received_date', header: 'Received', sortField: 'received_date', render: (l) => l.received_date.slice(0, 10) },
    { key: 'unit_cost', header: 'Unit cost', align: 'right', sortField: 'unit_cost', render: (l) => money(l.unit_cost) },
    { key: 'quantity_received', header: 'Received qty', align: 'right', sortField: 'quantity_received', render: (l) => qty(l.quantity_received) },
    { key: 'quantity_remaining', header: 'Remaining', align: 'right', sortField: 'quantity_remaining', render: (l) => qty(l.quantity_remaining) },
    { key: 'remaining_value', header: 'Value', align: 'right', sortField: 'value', render: (l) => money(l.remaining_value) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sortable: false,
      render: (l) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon variant="subtle" onClick={() => openEdit(l)}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="subtle" color="red" onClick={() => onDelete(l)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Stock"
        subtitle="Every lot of stock with its own cost basis (FIFO)"
        actionLabel="Add stock"
        onAction={openAdd}
      >
        <DataActions entity="stock" label="Stock" />
      </PageHeader>

      <Card withBorder radius="md" p="md">
        <QueryBoundary isLoading={lots.isLoading} isError={lots.isError} error={lots.error}>
          <DataTable
            data={lots.data?.results ?? []}
            columns={columns}
            getRowKey={(l) => l.id}
            searchPlaceholder="Search stock…"
            emptyMessage="No stock matches. Adjust your search or filter."
            server={{
              search: controls.search,
              onSearch: controls.setSearch,
              ordering: controls.ordering,
              onOrder: controls.onOrder,
              page: controls.page,
              onPage: controls.setPage,
              total: lots.data?.count ?? 0,
              pageSize: controls.pageSize,
              loading: lots.isFetching,
            }}
            filters={
              <Select
                data={productOptions}
                value={product}
                onChange={(v) => setProduct(v ?? '')}
                aria-label="Filter by product"
                searchable
                w={200}
                allowDeselect={false}
              />
            }
          />
        </QueryBoundary>
      </Card>

      <StockFormModal
        opened={opened}
        onClose={modal.close}
        products={products.data ?? []}
        lot={editing}
      />
    </>
  );
}
