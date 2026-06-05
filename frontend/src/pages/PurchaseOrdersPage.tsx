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
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  usePurchaseOrders,
} from '../api/purchaseOrders';
import { OrderFormModal, type OrderFormValues } from '../components/OrderFormModal';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { money, qty } from '../lib/format';

export function PurchaseOrdersPage() {
  const orders = usePurchaseOrders();
  const products = useProducts();
  const create = useCreatePurchaseOrder();
  const remove = useDeletePurchaseOrder();
  const [opened, modal] = useDisclosure(false);

  const onSubmit = async (values: OrderFormValues) => {
    try {
      await create.mutateAsync({
        reference: values.reference,
        supplier: values.party,
        order_date: values.order_date,
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

  const onDelete = async (id: number) => {
    if (!confirm('Delete this purchase order?')) return;
    try {
      await remove.mutateAsync(id);
      notifications.show({ color: 'green', message: 'Purchase order deleted' });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        subtitle="Buy stock — each line creates a costed stock lot"
        actionLabel="New purchase order"
        onAction={modal.open}
      />

      <Card withBorder radius="md" p="xs">
        <QueryBoundary isLoading={orders.isLoading} isError={orders.isError} error={orders.error}>
          {orders.data?.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No purchase orders yet.
            </Text>
          ) : (
            <Accordion variant="separated">
              {orders.data?.map((po) => (
                <Accordion.Item key={po.id} value={String(po.id)}>
                  <Group wrap="nowrap" pr="md">
                    <Accordion.Control>
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Text fw={600}>{po.reference || `PO #${po.id}`}</Text>
                          <Text size="xs" c="dimmed">
                            {po.order_date} · {po.supplier || 'No supplier'}
                          </Text>
                        </div>
                        <Group gap="xs">
                          <Badge variant="light">{po.items.length} items</Badge>
                          <Badge color="blue" variant="light">
                            {money(po.total_cost)}
                          </Badge>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <ActionIcon color="red" variant="subtle" onClick={() => onDelete(po.id)}>
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                  <Accordion.Panel>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Product</Table.Th>
                          <Table.Th ta="right">Quantity</Table.Th>
                          <Table.Th ta="right">Unit cost</Table.Th>
                          <Table.Th ta="right">Line total</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {po.items.map((it) => (
                          <Table.Tr key={it.id}>
                            <Table.Td>{it.product_name}</Table.Td>
                            <Table.Td ta="right">{qty(it.quantity)}</Table.Td>
                            <Table.Td ta="right">{money(it.unit_cost)}</Table.Td>
                            <Table.Td ta="right">{money(it.line_total)}</Table.Td>
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
        title="New purchase order"
        products={products.data ?? []}
        partyLabel="Supplier"
        priceLabel="Unit cost"
        submitting={create.isPending}
        onSubmit={onSubmit}
      />
    </>
  );
}
