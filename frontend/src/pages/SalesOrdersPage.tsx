import {
  Accordion,
  ActionIcon,
  Badge,
  Card,
  Group,
  Table,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import {
  useCreateSalesOrder,
  useDeleteSalesOrder,
  useSalesOrders,
} from '../api/salesOrders';
import { confirmDelete } from '../lib/confirm';
import { OrderFormModal, type OrderFormValues } from '../components/OrderFormModal';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { money, qty } from '../lib/format';

export function SalesOrdersPage() {
  const orders = useSalesOrders();
  const products = useProducts();
  const create = useCreateSalesOrder();
  const remove = useDeleteSalesOrder();
  const [opened, modal] = useDisclosure(false);

  const onSubmit = async (values: OrderFormValues) => {
    try {
      await create.mutateAsync({
        reference: values.reference,
        customer: values.party,
        order_date: values.order_date,
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

  const onDelete = (id: number) =>
    confirmDelete({
      title: 'Delete sales order',
      message: 'Deleting this sales order returns the sold stock to inventory.',
      onConfirm: async () => {
        try {
          await remove.mutateAsync(id);
          notifications.show({ color: 'green', message: 'Sales order deleted — stock restored' });
        } catch (err) {
          notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
        }
      },
    });

  return (
    <>
      <PageHeader
        title="Sales Orders"
        subtitle="Sell stock — COGS is drawn FIFO and profit is computed automatically"
        actionLabel="New sales order"
        onAction={modal.open}
      />

      <Card withBorder radius="md" p="xs">
        <QueryBoundary isLoading={orders.isLoading} isError={orders.isError} error={orders.error}>
          {orders.data?.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No sales orders yet.
            </Text>
          ) : (
            <Accordion variant="separated">
              {orders.data?.map((so) => (
                <Accordion.Item key={so.id} value={String(so.id)}>
                  <Group wrap="nowrap" pr="md">
                    <Accordion.Control>
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Text fw={600}>{so.reference || `SO #${so.id}`}</Text>
                          <Text size="xs" c="dimmed">
                            {so.order_date} · {so.customer || 'No customer'}
                          </Text>
                        </div>
                        <Group gap="xs">
                          <Badge color="teal" variant="light">
                            Rev {money(so.total_revenue)}
                          </Badge>
                          <Badge color={Number(so.total_profit) >= 0 ? 'green' : 'red'} variant="light">
                            Profit {money(so.total_profit)}
                          </Badge>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <ActionIcon color="red" variant="subtle" onClick={() => onDelete(so.id)}>
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                  <Accordion.Panel>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Product</Table.Th>
                          <Table.Th ta="right">Quantity</Table.Th>
                          <Table.Th ta="right">Unit price</Table.Th>
                          <Table.Th ta="right">Revenue</Table.Th>
                          <Table.Th ta="right">COGS</Table.Th>
                          <Table.Th ta="right">Profit</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {so.items.map((it) => (
                          <Table.Tr key={it.id}>
                            <Table.Td>{it.product_name}</Table.Td>
                            <Table.Td ta="right">{qty(it.quantity)}</Table.Td>
                            <Table.Td ta="right">{money(it.unit_price)}</Table.Td>
                            <Table.Td ta="right">{money(it.revenue)}</Table.Td>
                            <Table.Td ta="right">{money(it.cogs)}</Table.Td>
                            <Table.Td ta="right">{money(it.profit)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </QueryBoundary>
      </Card>

      <OrderFormModal
        opened={opened}
        onClose={modal.close}
        title="New sales order"
        products={products.data ?? []}
        partyLabel="Customer"
        priceLabel="Unit price"
        submitting={create.isPending}
        onSubmit={onSubmit}
      />
    </>
  );
}
