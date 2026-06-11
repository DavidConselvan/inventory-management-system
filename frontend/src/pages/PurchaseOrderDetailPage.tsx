import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconPencil } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import {
  useDeletePurchaseOrder,
  usePurchaseOrder,
  useUpdatePurchaseOrder,
} from '../api/purchaseOrders';
import { OrderFormModal, type OrderFormValues } from '../components/OrderFormModal';
import { QueryBoundary } from '../components/QueryBoundary';
import { confirmDelete } from '../lib/confirm';
import { money, qty } from '../lib/format';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'DRAFT', label: 'Draft' },
];

export function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();

  const order = usePurchaseOrder(orderId);
  const products = useProducts();
  const update = useUpdatePurchaseOrder();
  const remove = useDeletePurchaseOrder();
  const [editOpened, editModal] = useDisclosure(false);

  const po = order.data;

  const initial: OrderFormValues | null = po
    ? {
        reference: po.reference,
        party: po.supplier,
        order_date: po.order_date,
        status: po.status,
        notes: po.notes,
        items: po.items.map((i) => ({
          product: String(i.product),
          quantity: i.quantity,
          price: i.unit_cost,
        })),
      }
    : null;

  const onEdit = async (values: OrderFormValues) => {
    try {
      await update.mutateAsync({
        id: orderId,
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
      notifications.show({ color: 'green', message: 'Purchase order updated' });
      editModal.close();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: errorMessage(err) });
    }
  };

  const onDelete = () =>
    confirmDelete({
      title: 'Delete purchase order',
      message: 'This removes the purchase order. Stock lots it already brought in will remain.',
      onConfirm: async () => {
        try {
          await remove.mutateAsync(orderId);
          notifications.show({ color: 'green', message: 'Purchase order deleted' });
          navigate('/purchase-orders');
        } catch (err) {
          notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
        }
      },
    });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/purchase-orders" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Purchase Orders
        </Group>
      </Anchor>

      <QueryBoundary isLoading={order.isLoading} isError={order.isError} error={order.error}>
        {po && (
          <>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Title order={2}>{po.reference || `PO #${po.id}`}</Title>
                <Group gap="xs" mt={4}>
                  <Text c="dimmed" size="sm">
                    {po.order_date} · {po.supplier || 'No supplier'}
                  </Text>
                  <Badge variant="light" color={po.status === 'RECEIVED' ? 'forest' : 'gray'}>
                    {po.status.toLowerCase()}
                  </Badge>
                  <Badge color="blue" variant="light">
                    {money(po.total_cost)}
                  </Badge>
                </Group>
                {po.notes && (
                  <Text size="sm" mt="xs" maw={520}>
                    {po.notes}
                  </Text>
                )}
              </div>
              <Group>
                <Button variant="default" leftSection={<IconPencil size={16} />} onClick={editModal.open}>
                  Edit
                </Button>
                <Button color="red" variant="light" onClick={onDelete}>
                  Delete
                </Button>
              </Group>
            </Group>

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                Line items
              </Title>
              <Table.ScrollContainer minWidth={560}>
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
              </Table.ScrollContainer>
            </Card>
          </>
        )}
      </QueryBoundary>

      <OrderFormModal
        opened={editOpened}
        onClose={editModal.close}
        title="Edit purchase order"
        products={products.data ?? []}
        partyLabel="Supplier"
        priceLabel="Unit cost"
        statusOptions={STATUS_OPTIONS}
        submitting={update.isPending}
        submitLabel="Save changes"
        initial={initial}
        onSubmit={onEdit}
      />
    </Stack>
  );
}
