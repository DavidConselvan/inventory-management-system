import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCash,
  IconPencil,
  IconReceiptTax,
  IconTrendingUp,
} from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import {
  useDeleteSalesOrder,
  useSalesOrder,
  useUpdateSalesOrder,
} from '../api/salesOrders';
import { OrderFormModal, type OrderFormValues } from '../components/OrderFormModal';
import { QueryBoundary } from '../components/QueryBoundary';
import { StatCard } from '../components/StatCard';
import { confirmDelete } from '../lib/confirm';
import { money, qty } from '../lib/format';

const STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'DRAFT', label: 'Draft' },
];

export function SalesOrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();

  const order = useSalesOrder(orderId);
  const products = useProducts();
  const update = useUpdateSalesOrder();
  const remove = useDeleteSalesOrder();
  const [editOpened, editModal] = useDisclosure(false);

  const so = order.data;

  const initial: OrderFormValues | null = so
    ? {
        reference: so.reference,
        party: so.customer,
        order_date: so.order_date,
        status: so.status,
        notes: so.notes,
        items: so.items.map((i) => ({
          product: String(i.product),
          quantity: i.quantity,
          price: i.unit_price,
        })),
      }
    : null;

  const onEdit = async (values: OrderFormValues) => {
    try {
      await update.mutateAsync({
        id: orderId,
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
      notifications.show({ color: 'green', message: 'Sales order updated' });
      editModal.close();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: errorMessage(err) });
    }
  };

  const onDelete = () =>
    confirmDelete({
      title: 'Delete sales order',
      message: 'Deleting this sales order returns the sold stock to inventory.',
      onConfirm: async () => {
        try {
          await remove.mutateAsync(orderId);
          notifications.show({ color: 'green', message: 'Sales order deleted — stock restored' });
          navigate('/sales-orders');
        } catch (err) {
          notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
        }
      },
    });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/sales-orders" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Sales Orders
        </Group>
      </Anchor>

      <QueryBoundary isLoading={order.isLoading} isError={order.isError} error={order.error}>
        {so && (
          <>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Title order={2}>{so.reference || `SO #${so.id}`}</Title>
                <Group gap="xs" mt={4}>
                  <Text c="dimmed" size="sm">
                    {so.order_date} · {so.customer || 'No customer'}
                  </Text>
                  <Badge variant="light" color={so.status === 'CONFIRMED' ? 'forest' : 'gray'}>
                    {so.status.toLowerCase()}
                  </Badge>
                </Group>
                {so.notes && (
                  <Text size="sm" mt="xs" maw={520}>
                    {so.notes}
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

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <StatCard label="Revenue" value={money(so.total_revenue)} icon={IconCash} color="teal" />
              <StatCard label="COGS" value={money(so.total_cogs)} icon={IconReceiptTax} color="orange" />
              <StatCard label="Profit" value={money(so.total_profit)} icon={IconTrendingUp} color="forest" />
            </SimpleGrid>

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                Line items
              </Title>
              <Table.ScrollContainer minWidth={720}>
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
              </Table.ScrollContainer>
            </Card>
          </>
        )}
      </QueryBoundary>

      <OrderFormModal
        opened={editOpened}
        onClose={editModal.close}
        title="Edit sales order"
        products={products.data ?? []}
        partyLabel="Customer"
        priceLabel="Unit price"
        statusOptions={STATUS_OPTIONS}
        submitting={update.isPending}
        submitLabel="Save changes"
        initial={initial}
        onSubmit={onEdit}
      />
    </Stack>
  );
}
