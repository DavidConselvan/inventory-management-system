import { ActionIcon, Anchor, Card, Group, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import { useDeleteStock, useStockLots } from '../api/stockLots';
import type { StockLot } from '../api/types';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { StockFormModal } from '../components/StockFormModal';
import { confirmDelete } from '../lib/confirm';
import { money, qty } from '../lib/format';

export function StockPage() {
  const lots = useStockLots();
  const products = useProducts();
  const remove = useDeleteStock();
  const [opened, modal] = useDisclosure(false);
  const [editing, setEditing] = useState<StockLot | null>(null);

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
      sortValue: (l) => l.lot_code,
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
      sortValue: (l) => l.product_name,
      render: (l) => (
        <Anchor component={Link} to={`/products/${l.product}`} onClick={(e) => e.stopPropagation()}>
          {l.product_name}
        </Anchor>
      ),
    },
    { key: 'received_date', header: 'Received', sortValue: (l) => l.received_date, render: (l) => l.received_date.slice(0, 10) },
    { key: 'unit_cost', header: 'Unit cost', align: 'right', sortValue: (l) => Number(l.unit_cost), render: (l) => money(l.unit_cost) },
    { key: 'quantity_received', header: 'Received qty', align: 'right', sortValue: (l) => Number(l.quantity_received), render: (l) => qty(l.quantity_received) },
    { key: 'quantity_remaining', header: 'Remaining', align: 'right', sortValue: (l) => Number(l.quantity_remaining), render: (l) => qty(l.quantity_remaining) },
    { key: 'remaining_value', header: 'Value', align: 'right', sortValue: (l) => Number(l.remaining_value), render: (l) => money(l.remaining_value) },
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
        title="Stock"
        subtitle="Every lot of stock with its own cost basis (FIFO)"
        actionLabel="Add stock"
        onAction={openAdd}
      />

      <Card withBorder radius="md" p="md">
        <QueryBoundary isLoading={lots.isLoading} isError={lots.isError} error={lots.error}>
          <DataTable
            data={lots.data ?? []}
            columns={columns}
            getRowKey={(l) => l.id}
            searchText={(l) => `${l.lot_code} ${l.product_name}`}
            searchPlaceholder="Search stock…"
            emptyMessage="No stock yet. Add stock manually or via a purchase order."
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
