import {
  ActionIcon,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect } from 'react';

import type { Product } from '../api/types';
import { money } from '../lib/format';

export interface OrderItemValue {
  product: string;
  quantity: number | string;
  price: number | string;
}

export interface OrderFormValues {
  reference: string;
  party: string;
  order_date: string;
  status: string;
  notes: string;
  items: OrderItemValue[];
}

interface OrderFormModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  products: Product[];
  partyLabel: string;
  priceLabel: string;
  statusOptions: { value: string; label: string }[];
  submitting: boolean;
  submitLabel?: string;
  initial?: OrderFormValues | null;
  onSubmit: (values: OrderFormValues) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): OrderItemValue => ({ product: '', quantity: 1, price: 0 });

export function OrderFormModal({
  opened,
  onClose,
  title,
  products,
  partyLabel,
  priceLabel,
  statusOptions,
  submitting,
  submitLabel = 'Create',
  initial,
  onSubmit,
}: OrderFormModalProps) {
  const blank = (): OrderFormValues => ({
    reference: '',
    party: '',
    order_date: today(),
    status: statusOptions[0]?.value ?? '',
    notes: '',
    items: [emptyItem()],
  });

  const form = useForm<OrderFormValues>({
    initialValues: blank(),
    validate: {
      order_date: (v) => (v ? null : 'Required'),
      items: {
        product: (v) => (v ? null : 'Select a product'),
        quantity: (v) => (Number(v) > 0 ? null : '> 0'),
      },
    },
  });

  useEffect(() => {
    if (opened) form.setValues(initial ?? blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, initial]);

  const productOptions = products.map((p) => ({ value: String(p.id), label: `${p.name} (${p.sku})` }));
  const total = form.values.items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.price || 0),
    0,
  );
  const submit = form.onSubmit((values) => onSubmit(values));

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" centered>
      <form onSubmit={submit}>
        <Stack>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Reference" placeholder="Optional" {...form.getInputProps('reference')} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label={partyLabel} placeholder="Optional" {...form.getInputProps('party')} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput type="date" label="Order date" withAsterisk {...form.getInputProps('order_date')} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Status"
                data={statusOptions}
                allowDeselect={false}
                {...form.getInputProps('status')}
              />
            </Grid.Col>
          </Grid>

          <Divider label="Line items" labelPosition="left" />

          {form.values.items.map((item, index) => {
            const lineProduct = products.find((p) => String(p.id) === item.product);
            const wholeOnly = lineProduct?.unit === 'UNIT';
            return (
            <Group key={index} align="flex-end" wrap="nowrap">
              <Select
                label={index === 0 ? 'Product' : undefined}
                placeholder="Select product"
                searchable
                data={productOptions}
                style={{ flex: 1 }}
                {...form.getInputProps(`items.${index}.product`)}
              />
              <NumberInput
                label={index === 0 ? 'Quantity' : undefined}
                min={0}
                allowDecimal={!wholeOnly}
                decimalScale={wholeOnly ? 0 : 4}
                w={120}
                {...form.getInputProps(`items.${index}.quantity`)}
              />
              <NumberInput
                label={index === 0 ? priceLabel : undefined}
                min={0}
                decimalScale={4}
                prefix="$"
                w={140}
                {...form.getInputProps(`items.${index}.price`)}
              />
              <Text size="sm" w={90} ta="right" mb={8}>
                {money(Number(item.quantity || 0) * Number(item.price || 0))}
              </Text>
              <ActionIcon
                color="red"
                variant="subtle"
                mb={6}
                disabled={form.values.items.length === 1}
                onClick={() => form.removeListItem('items', index)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
            );
          })}

          <Group justify="space-between">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => form.insertListItem('items', emptyItem())}
            >
              Add line
            </Button>
            <Text fw={600}>Total: {money(total)}</Text>
          </Group>

          <Textarea label="Notes" autosize minRows={2} {...form.getInputProps('notes')} />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
