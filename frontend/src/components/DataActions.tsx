import { Button, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconFileExport, IconFileImport } from '@tabler/icons-react';

import { errorMessage } from '../api/client';
import { exportCsv, type Entity } from '../api/dataio';
import { ImportModal } from './ImportModal';

interface DataActionsProps {
  entity: Entity;
  label: string;
}

/** Export (instant download) + Import (modal) buttons for a list page. */
export function DataActions({ entity, label }: DataActionsProps) {
  const [opened, modal] = useDisclosure(false);

  const onExport = () =>
    exportCsv(entity).catch((err) =>
      notifications.show({ color: 'red', title: 'Export failed', message: errorMessage(err) }),
    );

  return (
    <Group gap="xs">
      <Button variant="default" leftSection={<IconFileExport size={16} />} onClick={onExport}>
        Export
      </Button>
      <Button variant="default" leftSection={<IconFileImport size={16} />} onClick={modal.open}>
        Import
      </Button>
      <ImportModal opened={opened} onClose={modal.close} entity={entity} label={label} />
    </Group>
  );
}
