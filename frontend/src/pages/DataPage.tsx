import { Button, Card, Group, Select, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconFileExport, IconFileImport, IconFileSpreadsheet } from '@tabler/icons-react';
import { useState } from 'react';

import { errorMessage } from '../api/client';
import { downloadTemplate, exportCsv, type Entity } from '../api/dataio';
import { ImportModal } from '../components/ImportModal';
import { PageHeader } from '../components/PageHeader';

const ENTITIES: { value: Entity; label: string }[] = [
  { value: 'products', label: 'Products' },
  { value: 'stock', label: 'Stock' },
  { value: 'purchase-orders', label: 'Purchase Orders' },
  { value: 'sales-orders', label: 'Sales Orders' },
];

export function DataPage() {
  const [entity, setEntity] = useState<Entity>('products');
  const [opened, modal] = useDisclosure(false);
  const label = ENTITIES.find((e) => e.value === entity)!.label;

  const onExport = () =>
    exportCsv(entity).catch((err) =>
      notifications.show({ color: 'red', title: 'Export failed', message: errorMessage(err) }),
    );

  return (
    <>
      <PageHeader
        title="Import / Export"
        subtitle="Bulk-load data from CSV or export it — also available on each list page"
      />

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Select
            label="Entity"
            data={ENTITIES}
            value={entity}
            allowDeselect={false}
            onChange={(v) => setEntity(v as Entity)}
            w={220}
          />
          <Group>
            <Button variant="default" leftSection={<IconFileSpreadsheet size={16} />} onClick={() => downloadTemplate(entity)}>
              Template
            </Button>
            <Button variant="light" leftSection={<IconFileExport size={16} />} onClick={onExport}>
              Export CSV
            </Button>
            <Button leftSection={<IconFileImport size={16} />} onClick={modal.open}>
              Import CSV
            </Button>
          </Group>
        </Group>
        <Text size="sm" c="dimmed" mt="md">
          Import auto-maps spreadsheet columns to the schema, previews the result, and validates every row before writing.
        </Text>
      </Card>

      <ImportModal opened={opened} onClose={modal.close} entity={entity} label={label} />
    </>
  );
}
