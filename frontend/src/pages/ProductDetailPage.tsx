import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCash,
  IconPencil,
  IconPlus,
  IconReceiptTax,
  IconTrash,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { errorMessage } from '../api/client';
import {
  useDeleteProduct,
  useProduct,
  useProductFinancials,
} from '../api/products';
import { useDeleteStock, useStockLots } from '../api/stockLots';
import type { StockLot } from '../api/types';
import { DataTable, type Column } from '../components/DataTable';
import { ProductFormModal } from '../components/ProductFormModal';
import { QueryBoundary } from '../components/QueryBoundary';
import { StatCard } from '../components/StatCard';
import { StockFormModal } from '../components/StockFormModal';
import { confirmDelete } from '../lib/confirm';
import { money, percent, qty } from '../lib/format';

export function ProductDetailPage() {
  const { id } = useParams();
  const productId = Number(id);
  const navigate = useNavigate();

  const product = useProduct(productId);
  const financials = useProductFinancials(productId);
  const lots = useStockLots(productId);

  const deleteProduct = useDeleteProduct();
  const deleteStock = useDeleteStock();

  const [editOpened, editModal] = useDisclosure(false);
  const [stockOpened, stockModal] = useDisclosure(false);
  const [editingLot, setEditingLot] = useState<StockLot | null>(null);

  const openAddStock = () => {
    setEditingLot(null);
    stockModal.open();
  };
  const openEditStock = (lot: StockLot) => {
    setEditingLot(lot);
    stockModal.open();
  };

  const onDeleteProduct = () =>
    confirmDelete({
      title: 'Delete product',
      message: `"${product.data?.name}" will be removed. Products referenced by orders or stock can't be deleted.`,
      onConfirm: async () => {
        try {
          await deleteProduct.mutateAsync(productId);
          notifications.show({ color: 'green', message: 'Product deleted' });
          navigate('/products');
        } catch (err) {
          notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
        }
      },
    });

  const onDeleteLot = (lot: StockLot) =>
    confirmDelete({
      title: 'Delete stock lot',
      message: `Lot ${lot.lot_code} will be removed. A lot that has been sold from can't be deleted.`,
      onConfirm: async () => {
        try {
          await deleteStock.mutateAsync(lot.id);
          notifications.show({ color: 'green', message: 'Stock lot deleted' });
        } catch (err) {
          notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
        }
      },
    });

  const unit = product.data?.unit.toLowerCase() ?? '';

  const lotColumns: Column<StockLot>[] = [
    { key: 'lot_code', header: 'Lot', sortValue: (l) => l.lot_code, render: (l) => <Text size="sm" ff="monospace">{l.lot_code}</Text> },
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
            <ActionIcon variant="subtle" onClick={() => openEditStock(l)}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="subtle" color="red" onClick={() => onDeleteLot(l)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/products" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Products
        </Group>
      </Anchor>

      <QueryBoundary isLoading={product.isLoading} isError={product.isError} error={product.error}>
        {product.data && (
          <>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Title order={2}>{product.data.name}</Title>
                <Group gap="xs" mt={4}>
                  <Badge variant="default">{product.data.sku}</Badge>
                  <Badge variant="light">{product.data.unit.toLowerCase()}</Badge>
                </Group>
                {product.data.description && (
                  <Text c="dimmed" size="sm" mt="xs" maw={520}>
                    {product.data.description}
                  </Text>
                )}
              </div>
              <Group>
                <Button variant="default" leftSection={<IconPencil size={16} />} onClick={editModal.open}>
                  Edit
                </Button>
                <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={onDeleteProduct}>
                  Delete
                </Button>
              </Group>
            </Group>

            <QueryBoundary isLoading={financials.isLoading} isError={financials.isError} error={financials.error}>
              {financials.data && (
                <SimpleGrid cols={{ base: 2, sm: 4 }}>
                  <StatCard label="Revenue" value={money(financials.data.revenue)} icon={IconCash} color="teal" />
                  <StatCard label="COGS" value={money(financials.data.cogs)} icon={IconReceiptTax} color="orange" />
                  <StatCard label="Profit" value={money(financials.data.profit)} icon={IconTrendingUp} color="forest" />
                  <StatCard label="Margin" value={percent(financials.data.margin_percent)} icon={IconTrendingUp} color="grape" />
                </SimpleGrid>
              )}
            </QueryBoundary>

            {financials.data && (
              <Card withBorder radius="md" p="md">
                <Group gap="xl">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>On hand</Text>
                    <Text fw={600}>{qty(financials.data.quantity_on_hand)} {unit}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Inventory value</Text>
                    <Text fw={600}>{money(financials.data.inventory_value)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Purchased</Text>
                    <Text fw={600}>{qty(financials.data.purchased_quantity)} {unit} · {money(financials.data.purchased_cost)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Sold</Text>
                    <Text fw={600}>{qty(financials.data.sold_quantity)} {unit}</Text>
                  </div>
                </Group>
              </Card>
            )}

            <Card withBorder radius="md" p="lg">
              <Group justify="space-between" mb="md">
                <Title order={4}>Stock lots</Title>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openAddStock}>
                  Add stock
                </Button>
              </Group>
              <QueryBoundary isLoading={lots.isLoading} isError={lots.isError} error={lots.error}>
                <DataTable
                  data={lots.data ?? []}
                  columns={lotColumns}
                  getRowKey={(l) => l.id}
                  pageSize={8}
                  emptyMessage="No stock yet. Add stock or receive a purchase order."
                />
              </QueryBoundary>
            </Card>
          </>
        )}
      </QueryBoundary>

      <ProductFormModal opened={editOpened} onClose={editModal.close} product={product.data} />
      <StockFormModal
        opened={stockOpened}
        onClose={stockModal.close}
        productId={productId}
        productUnit={product.data?.unit}
        lot={editingLot}
      />
    </Stack>
  );
}
