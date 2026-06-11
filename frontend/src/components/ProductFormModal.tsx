import { Button, Group, Modal, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';

import { errorMessage } from '../api/client';
import { useSaveProduct, type ProductInput } from '../api/products';
import { UNIT_OPTIONS, type Product } from '../api/types';

interface ProductFormModalProps {
  opened: boolean;
  onClose: () => void;
  product?: Product | null;
}

const blank: ProductInput = { name: '', description: '', sku: '', unit: 'UNIT' };

export function ProductFormModal({ opened, onClose, product }: ProductFormModalProps) {
  const save = useSaveProduct();
  const form = useForm<ProductInput>({
    initialValues: blank,
    validate: {
      name: (v) => (v ? null : 'Required'),
      sku: (v) => (v ? null : 'Required'),
    },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(
        product
          ? {
              name: product.name,
              description: product.description,
              sku: product.sku,
              unit: product.unit,
            }
          : blank,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, product]);

  const submit = form.onSubmit(async (values) => {
    try {
      await save.mutateAsync({ ...values, id: product?.id });
      notifications.show({ color: 'green', message: product ? 'Product updated' : 'Product created' });
      onClose();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: errorMessage(err) });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title={product ? 'Edit product' : 'New product'} centered>
      <form onSubmit={submit}>
        <Stack>
          <TextInput label="Name" withAsterisk {...form.getInputProps('name')} />
          <TextInput label="SKU / Code" withAsterisk {...form.getInputProps('sku')} />
          <Select label="Unit" data={UNIT_OPTIONS} allowDeselect={false} {...form.getInputProps('unit')} />
          <Textarea label="Description" autosize minRows={2} {...form.getInputProps('description')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {product ? 'Save changes' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
