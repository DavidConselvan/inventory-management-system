import { Button, Group, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';

import { errorMessage } from '../api/client';
import { useAddStock, useUpdateStock } from '../api/stockLots';
import type { Product, StockLot, Unit } from '../api/types';

interface StockFormModalProps {
  opened: boolean;
  onClose: () => void;
  productId?: number; // fixed product (from a product page)
  productUnit?: Unit; // its unit, so the quantity field can enforce whole units
  products?: Product[]; // selectable products (from the stock page)
  lot?: StockLot | null; // present when editing
}

export function StockFormModal({ opened, onClose, productId, productUnit, products, lot }: StockFormModalProps) {
  const add = useAddStock();
  const update = useUpdateStock();

  const form = useForm({
    initialValues: {
      product: productId ? String(productId) : '',
      quantity_received: 0 as number | string,
      unit_cost: 0 as number | string,
      received_date: '',
    },
    validate: {
      product: (v) => (v ? null : 'Select a product'),
      quantity_received: (v) => (Number(v) > 0 ? null : 'Must be greater than 0'),
    },
  });

  useEffect(() => {
    if (!opened) return;
    form.setValues({
      product: String(lot?.product ?? productId ?? ''),
      quantity_received: lot ? lot.quantity_received : 0,
      unit_cost: lot ? lot.unit_cost : 0,
      received_date: lot ? lot.received_date.slice(0, 10) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, lot, productId]);

  const submit = form.onSubmit(async (values) => {
    try {
      if (lot) {
        await update.mutateAsync({
          id: lot.id,
          product: Number(values.product),
          quantity_received: String(values.quantity_received),
          unit_cost: String(values.unit_cost),
          received_date: values.received_date || undefined,
        });
        notifications.show({ color: 'green', message: 'Stock updated' });
      } else {
        await add.mutateAsync({
          product: Number(values.product),
          quantity_received: String(values.quantity_received),
          unit_cost: String(values.unit_cost),
          received_date: values.received_date || undefined,
        });
        notifications.show({ color: 'green', message: 'Stock added' });
      }
      onClose();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save stock', message: errorMessage(err) });
    }
  });

  const selectedUnit =
    products?.find((p) => String(p.id) === form.values.product)?.unit ?? productUnit;
  const wholeOnly = selectedUnit === 'UNIT';

  return (
    <Modal opened={opened} onClose={onClose} title={lot ? 'Edit stock lot' : 'Add stock'} centered>
      <form onSubmit={submit}>
        <Stack>
          {!productId && (
            <Select
              label="Product"
              withAsterisk
              searchable
              disabled={!!lot}
              data={(products ?? []).map((p) => ({ value: String(p.id), label: `${p.name} (${p.sku})` }))}
              {...form.getInputProps('product')}
            />
          )}
          <NumberInput
            label="Quantity"
            withAsterisk
            min={0}
            allowDecimal={wholeOnly ? false : true}
            decimalScale={wholeOnly ? 0 : 4}
            {...form.getInputProps('quantity_received')}
          />
          <NumberInput label="Unit cost" min={0} decimalScale={4} prefix="$" {...form.getInputProps('unit_cost')} />
          <TextInput type="date" label="Received date" {...form.getInputProps('received_date')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={add.isPending || update.isPending}>
              {lot ? 'Save changes' : 'Add stock'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
