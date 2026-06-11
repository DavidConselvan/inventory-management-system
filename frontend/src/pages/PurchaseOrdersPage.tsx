import { Badge, Card, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import { useCreatePurchaseOrder, usePurchaseOrders } from '../api/purchaseOrders';
import type { PurchaseOrder } from '../api/types';
import { DataTable, type Column } from '../components/DataTable';
import { OrderFormModal, type OrderFormValues } from '../components/OrderFormModal';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { money } from '../lib/format';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'DRAFT', label: 'Draft' },
];

export function PurchaseOrdersPage() {
  const orders = usePurchaseOrders();
  const products = useProducts();
  const create = useCreatePurchaseOrder();
  const navigate = useNavigate();
  const [opened, modal] = useDisclosure(false);

  const onCreate = async (values: OrderFormValues) => {
    try {
      await create.mutateAsync({
        reference: values.reference,
        supplier: values.party,
        order_date: values.order_date,
        status: values.status,
        notes: values.notes,
        items: values.items.map((it) => ({
          product: Number(it.product),
          quantity: String(it.quantity),
          unit_cost: String(it.price),
        })),
      });
      notifications.show({ color: 'green', message: 'Purchase order created — stock received' });
      modal.close();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not create', message: errorMessage(err) });
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'reference',
      header: 'Reference',
      sortValue: (o) => o.reference || `PO #${o.id}`,
      render: (o) => <Text fw={500}>{o.reference || `PO #${o.id}`}</Text>,
    },
    { key: 'order_date', header: 'Date', sortValue: (o) => o.order_date },
    { key: 'supplier', header: 'Supplier', sortValue: (o) => o.supplier, render: (o) => o.supplier || '—' },
    { key: 'items', header: 'Items', align: 'right', sortValue: (o) => o.items.length, render: (o) => o.items.length },
    {
      key: 'total_cost',
      header: 'Total',
      align: 'right',
      sortValue: (o) => Number(o.total_cost),
      render: (o) => <Badge variant="light">{money(o.total_cost)}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        subtitle="Buy stock — each line creates a costed lot. Click an order to view or edit it."
        actionLabel="New purchase order"
        onAction={modal.open}
      />

      <Card withBorder radius="md" p="md">
        <QueryBoundary isLoading={orders.isLoading} isError={orders.isError} error={orders.error}>
          <DataTable
            data={orders.data ?? []}
            columns={columns}
            getRowKey={(o) => o.id}
            searchText={(o) => `${o.reference} ${o.supplier}`}
            searchPlaceholder="Search purchase orders…"
            onRowClick={(o) => navigate(`/purchase-orders/${o.id}`)}
            emptyMessage="No purchase orders yet."
          />
        </QueryBoundary>
      </Card>

      <OrderFormModal
        opened={opened}
        onClose={modal.close}
        title="New purchase order"
        products={products.data ?? []}
        partyLabel="Supplier"
        priceLabel="Unit cost"
        statusOptions={STATUS_OPTIONS}
        submitting={create.isPending}
        onSubmit={onCreate}
      />
    </>
  );
}
