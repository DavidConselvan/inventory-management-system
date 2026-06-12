import { Badge, Card, Select, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import { useCreateSalesOrder, useSalesOrderList } from '../api/salesOrders';
import type { SalesOrder } from '../api/types';
import { DataTable, type Column } from '../components/DataTable';
import { DataActions } from '../components/DataActions';
import { OrderFormModal, type OrderFormValues } from '../components/OrderFormModal';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { money } from '../lib/format';
import { useListControls } from '../lib/useListControls';

const STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'DRAFT', label: 'Draft' },
];

const STATUS_FILTER = [
  { value: '', label: 'All statuses' },
  ...STATUS_OPTIONS,
];

export function SalesOrdersPage() {
  const [status, setStatus] = useState('');
  const controls = useListControls({ ordering: '-order_date', filters: { status } });
  const orders = useSalesOrderList(controls.params);
  const products = useProducts();
  const create = useCreateSalesOrder();
  const navigate = useNavigate();
  const [opened, modal] = useDisclosure(false);

  const onCreate = async (values: OrderFormValues) => {
    try {
      await create.mutateAsync({
        reference: values.reference,
        customer: values.party,
        order_date: values.order_date,
        status: values.status,
        notes: values.notes,
        items: values.items.map((it) => ({
          product: Number(it.product),
          quantity: String(it.quantity),
          unit_price: String(it.price),
        })),
      });
      notifications.show({ color: 'green', message: 'Sale recorded' });
      modal.close();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not record sale', message: errorMessage(err) });
    }
  };

  const columns: Column<SalesOrder>[] = [
    {
      key: 'reference',
      header: 'Reference',
      sortField: 'reference',
      render: (o) => <Text fw={500}>{o.reference || `SO #${o.id}`}</Text>,
    },
    { key: 'order_date', header: 'Date', sortField: 'order_date' },
    { key: 'customer', header: 'Customer', sortField: 'customer', render: (o) => o.customer || '—' },
    {
      key: 'total_revenue',
      header: 'Revenue',
      align: 'right',
      sortField: 'revenue',
      render: (o) => money(o.total_revenue),
    },
    {
      key: 'total_profit',
      header: 'Profit',
      align: 'right',
      sortField: 'profit',
      render: (o) => (
        <Badge color={Number(o.total_profit) >= 0 ? 'green' : 'red'} variant="light">
          {money(o.total_profit)}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Sales Orders"
        subtitle="Sell stock — COGS is drawn FIFO. Click an order to view or edit it."
        actionLabel="New sales order"
        onAction={modal.open}
      >
        <DataActions entity="sales-orders" label="Sales Orders" />
      </PageHeader>

      <Card withBorder radius="md" p="md">
        <QueryBoundary isLoading={orders.isLoading} isError={orders.isError} error={orders.error}>
          <DataTable
            data={orders.data?.results ?? []}
            columns={columns}
            getRowKey={(o) => o.id}
            searchPlaceholder="Search sales orders…"
            onRowClick={(o) => navigate(`/sales-orders/${o.id}`)}
            emptyMessage="No sales orders match. Adjust your search or filter."
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
        title="New sales order"
        products={products.data ?? []}
        partyLabel="Customer"
        priceLabel="Unit price"
        statusOptions={STATUS_OPTIONS}
        submitting={create.isPending}
        onSubmit={onCreate}
      />
    </>
  );
}
