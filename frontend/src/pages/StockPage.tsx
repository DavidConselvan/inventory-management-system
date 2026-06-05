import {
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

import { errorMessage } from '../api/client';
import { useProducts } from '../api/products';
import { useAddStock, useStockLots } from '../api/stockLots';
import { PageHeader } from '../components/PageHeader';
import { QueryBoundary } from '../components/QueryBoundary';
import { money, qty } from '../lib/format';

export function StockPage() {
  const lots = useStockLots();
  const products = useProducts();
  const addStock = useAddStock();
  const [opened, modal] = useDisclosure(false);

  const form = useForm({
    initialValues: { product: '', quantity_received: 0, unit_cost: 0 },
    validate: {
      product: (v) => (v ? null : 'Select a product'),
      quantity_received: (v) => (Number(v) > 0 ? null : 'Must be > 0'),
    },
  });

  const submit = form.onSubmit(async (values) => {
    try {
      await addStock.mutateAsync({
        product: Number(values.product),
        quantity_received: String(values.quantity_received),
        unit_cost: String(values.unit_cost),
      });
      notifications.show({ color: 'green', message: 'Stock added' });
      form.reset();
      modal.close();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not add stock', message: errorMessage(err) });
    }
  });

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Every lot of stock with its own cost basis (FIFO)"
        actionLabel="Add stock"
        onAction={modal.open}
      />

      <Card withBorder radius="md" p={0}>
        <QueryBoundary isLoading={lots.isLoading} isError={lots.isError} error={lots.error}>
          <Table.ScrollContainer minWidth={820}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Lot</Table.Th>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Received</Table.Th>
                  <Table.Th ta="right">Unit cost</Table.Th>
                  <Table.Th ta="right">Received qty</Table.Th>
                  <Table.Th ta="right">Remaining</Table.Th>
                  <Table.Th ta="right">Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lots.data?.map((lot) => (
                  <Table.Tr key={lot.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {lot.lot_code}
                      </Text>
                      <Text size="xs" c={lot.source_item ? 'blue' : 'dimmed'}>
                        {lot.source_item ? 'Purchase' : 'Manual'}
                      </Text>
                    </Table.Td>
                    <Table.Td>{lot.product_name}</Table.Td>
                    <Table.Td>{lot.received_date.slice(0, 10)}</Table.Td>
                    <Table.Td ta="right">{money(lot.unit_cost)}</Table.Td>
                    <Table.Td ta="right">{qty(lot.quantity_received)}</Table.Td>
                    <Table.Td ta="right">{qty(lot.quantity_remaining)}</Table.Td>
                    <Table.Td ta="right">{money(lot.remaining_value)}</Table.Td>
                  </Table.Tr>
                ))}
                {lots.data?.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text c="dimmed" ta="center" py="md">
                        No stock yet. Add stock manually or via a purchase order.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </QueryBoundary>
      </Card>

      <Modal opened={opened} onClose={modal.close} title="Add stock manually" centered>
        <form onSubmit={submit}>
          <Stack>
            <Select
              label="Product"
              withAsterisk
              searchable
              data={products.data?.map((p) => ({ value: String(p.id), label: `${p.name} (${p.sku})` })) ?? []}
              {...form.getInputProps('product')}
            />
            <NumberInput
              label="Quantity"
              withAsterisk
              min={0}
              decimalScale={4}
              {...form.getInputProps('quantity_received')}
            />
            <NumberInput
              label="Unit cost"
              min={0}
              decimalScale={4}
              prefix="$"
              {...form.getInputProps('unit_cost')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={modal.close}>
                Cancel
              </Button>
              <Button type="submit" loading={addStock.isPending}>
                Add stock
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
