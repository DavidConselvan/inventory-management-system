import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Select,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { IconChartBar, IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import { errorMessage } from '../api/client';
import {
  useDeleteProduct,
  useProductFinancials,
  useProducts,
  useSaveProduct,
  type ProductInput,
} from '../api/products';
import { UNIT_OPTIONS, type Product } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { StatCard } from '../components/StatCard';
import { money, percent, qty } from '../lib/format';
import { IconCash, IconReceiptTax, IconTrendingUp } from '@tabler/icons-react';

export function ProductsPage() {
  const products = useProducts();
  const save = useSaveProduct();
  const remove = useDeleteProduct();

  const [modalOpened, modal] = useDisclosure(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [financialsFor, setFinancialsFor] = useState<Product | null>(null);

  const form = useForm<ProductInput>({
    initialValues: { name: '', description: '', sku: '', unit: 'UNIT' },
    validate: {
      name: (v) => (v ? null : 'Required'),
      sku: (v) => (v ? null : 'Required'),
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.setValues({ name: '', description: '', sku: '', unit: 'UNIT' });
    modal.open();
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    form.setValues({
      name: product.name,
      description: product.description,
      sku: product.sku,
      unit: product.unit,
    });
    modal.open();
  };

  const submit = form.onSubmit(async (values) => {
    try {
      await save.mutateAsync({ ...values, id: editing?.id });
      notifications.show({ color: 'green', message: editing ? 'Product updated' : 'Product created' });
      modal.close();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: errorMessage(err) });
    }
  });

  const onDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      await remove.mutateAsync(product.id);
      notifications.show({ color: 'green', message: 'Product deleted' });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not delete', message: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Your catalog of sellable items"
        actionLabel="New product"
        onAction={openCreate}
      />

      <Card withBorder radius="md" p={0}>
        <QueryBoundary isLoading={products.isLoading} isError={products.isError} error={products.error}>
          <Table.ScrollContainer minWidth={640}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {products.data?.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Text fw={500}>{p.name}</Text>
                      {p.description && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {p.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="default">{p.sku}</Badge>
                    </Table.Td>
                    <Table.Td>{p.unit.toLowerCase()}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Tooltip label="Financials">
                          <ActionIcon variant="subtle" onClick={() => setFinancialsFor(p)}>
                            <IconChartBar size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" onClick={() => openEdit(p)}>
                            <IconPencil size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="subtle" color="red" onClick={() => onDelete(p)}>
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {products.data?.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text c="dimmed" ta="center" py="md">
                        No products yet. Create your first one.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </QueryBoundary>
      </Card>

      <Modal opened={modalOpened} onClose={modal.close} title={editing ? 'Edit product' : 'New product'} centered>
        <form onSubmit={submit}>
          <Stack>
            <TextInput label="Name" withAsterisk {...form.getInputProps('name')} />
            <TextInput label="SKU / Code" withAsterisk {...form.getInputProps('sku')} />
            <Select label="Unit" data={UNIT_OPTIONS} allowDeselect={false} {...form.getInputProps('unit')} />
            <Textarea label="Description" autosize minRows={2} {...form.getInputProps('description')} />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={modal.close}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                {editing ? 'Save changes' : 'Create'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <ProductFinancialsDrawer product={financialsFor} onClose={() => setFinancialsFor(null)} />
    </>
  );
}

function ProductFinancialsDrawer({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const fin = useProductFinancials(product?.id ?? 0, !!product);

  return (
    <Drawer opened={!!product} onClose={onClose} position="right" title={product?.name} size="md">
      {product && (
        <QueryBoundary isLoading={fin.isLoading} isError={fin.isError} error={fin.error}>
          {fin.data && (
            <Stack>
              <SimpleGrid cols={2}>
                <StatCard label="Revenue" value={money(fin.data.revenue)} icon={IconCash} color="teal" />
                <StatCard label="COGS" value={money(fin.data.cogs)} icon={IconReceiptTax} color="orange" />
                <StatCard label="Profit" value={money(fin.data.profit)} icon={IconTrendingUp} color="green" />
                <StatCard
                  label="Margin"
                  value={percent(fin.data.margin_percent)}
                  icon={IconTrendingUp}
                  color="grape"
                />
              </SimpleGrid>
              <Card withBorder radius="md" p="md">
                <Text size="sm" c="dimmed">
                  Purchased
                </Text>
                <Text>
                  {qty(fin.data.purchased_quantity)} {product.unit.toLowerCase()} ·{' '}
                  {money(fin.data.purchased_cost)}
                </Text>
                <Text size="sm" c="dimmed" mt="sm">
                  Sold
                </Text>
                <Text>
                  {qty(fin.data.sold_quantity)} {product.unit.toLowerCase()} ·{' '}
                  {money(fin.data.revenue)}
                </Text>
                <Text size="sm" c="dimmed" mt="sm">
                  On hand
                </Text>
                <Text>
                  {qty(fin.data.quantity_on_hand)} {product.unit.toLowerCase()} ·{' '}
                  {money(fin.data.inventory_value)} value
                </Text>
              </Card>
            </Stack>
          )}
        </QueryBoundary>
      )}
    </Drawer>
  );
}
