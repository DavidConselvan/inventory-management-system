import { Badge, Card, Select, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import { useCreatePurchaseOrder, usePurchaseOrderList } from '../api/purchaseOrders';
import type { PurchaseOrder } from '../api/types';
import { DataTable, type Column } from '../components/DataTable';
import { DataActions } from '../components/DataActions';
import { OrderFormModal, type OrderFormValues } from '../components/OrderFormModal';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { money } from '../lib/format';
import { useListControls } from '../lib/useListControls';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'DRAFT', label: 'Draft' },
];

const STATUS_FILTER = [
  { value: '', label: 'All statuses' },
  ...STATUS_OPTIONS,
];

export function PurchaseOrdersPage() {
  const [status, setStatus] = useState('');
  const controls = useListControls({ ordering: '-order_date', filters: { status } });
  const orders = usePurchaseOrderList(controls.params);
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
      sortField: 'reference',
      render: (o) => <Text fw={500}>{o.reference || `PO #${o.id}`}</Text>,
    },
    { key: 'order_date', header: 'Date', sortField: 'order_date' },
    { key: 'supplier', header: 'Supplier', sortField: 'supplier', render: (o) => o.supplier || '—' },
    { key: 'items', header: 'Items', align: 'right', render: (o) => o.items.length },
    {
      key: 'total_cost',
      header: 'Total',
      align: 'right',
      sortField: 'cost_total',
      render: (o) => <Badge variant="light">{money(o.total_cost)}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        title="Purchase Orders"
        subtitle="Buy stock — each line creates a costed lot. Click an order to view or edit it."
        actionLabel="New purchase order"
        onAction={modal.open}
      >
        <DataActions entity="purchase-orders" label="Purchase Orders" />
      </PageHeader>

      <Card withBorder radius="md" p="md">
        <QueryBoundary isLoading={orders.isLoading} isError={orders.isError} error={orders.error}>
          <DataTable
            data={orders.data?.results ?? []}
            columns={columns}
            getRowKey={(o) => o.id}
            searchPlaceholder="Search purchase orders…"
            onRowClick={(o) => navigate(`/purchase-orders/${o.id}`)}
            emptyMessage="No purchase orders match. Adjust your search or filter."
            server={{
              search: controls.search,
              onSearch: controls.setSearch,
              ordering: controls.ordering,
              onOrder: controls.onOrder,
              page: controls.page,
              onPage: controls.setPage,
              total: orders.data?.count ?? 0,
              pageSize: controls.pageSize,
              loading: orders.isFetching,
            }}
            filters={
              <Select
                data={STATUS_FILTER}
                value={status}
                onChange={(v) => setStatus(v ?? '')}
                aria-label="Filter by status"
                w={160}
                allowDeselect={false}
              />
            }
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
