import {
  Alert,
  Anchor,
  Badge,
  Button,
  Code,
  FileButton,
  Group,
  Modal,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconUpload } from '@tabler/icons-react';
import { useState } from 'react';

import { errorMessage } from '../api/client';
import {
  downloadTemplate,
  useImportCommit,
  useImportPreview,
  type Entity,
  type ImportResult,
} from '../api/dataio';

interface ImportModalProps {
  opened: boolean;
  onClose: () => void;
  entity: Entity;
  label: string;
}

export function ImportModal({ opened, onClose, entity, label }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const preview = useImportPreview();
  const commit = useImportCommit();

  const close = () => {
    setFile(null);
    setResult(null);
    preview.reset();
    commit.reset();
    onClose();
  };

  const onPick = async (picked: File | null) => {
    if (!picked) return;
    setFile(picked);
    setResult(null);
    try {
      setResult(await preview.mutateAsync({ entity, file: picked }));
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not read file', message: errorMessage(err) });
    }
  };

  const onCommit = async () => {
    if (!file) return;
    try {
      const res = await commit.mutateAsync({ entity, file });
      if (res.errors.length) {
        setResult(res);
        notifications.show({ color: 'red', title: 'Import rejected', message: 'Fix the errors and re-upload.' });
      } else {
        notifications.show({ color: 'green', message: `Imported ${res.created} row(s).` });
        close();
      }
    } catch (err) {
      notifications.show({ color: 'red', title: 'Import failed', message: errorMessage(err) });
    }
  };

  const cols = result?.preview?.length ? Object.keys(result.preview[0]) : [];

  return (
    <Modal opened={opened} onClose={close} title={`Import ${label}`} size="xl" centered>
      <Stack>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Upload a CSV — columns are matched to the schema automatically.
          </Text>
          <Anchor size="sm" onClick={() => downloadTemplate(entity)}>
            Download template
          </Anchor>
        </Group>

        <FileButton accept=".csv,text/csv" onChange={onPick}>
          {(props) => (
            <Button {...props} variant="light" leftSection={<IconUpload size={16} />} loading={preview.isPending}>
              {file ? `Replace file (${file.name})` : 'Choose CSV file'}
            </Button>
          )}
        </FileButton>

        {result && (
          <>
            <div>
              <Text size="sm" fw={600} mb={4}>
                Column mapping
              </Text>
              <Group gap="xs">
                {Object.entries(result.mapping).map(([field, col]) => (
                  <Badge key={field} variant={col ? 'light' : 'outline'} color={col ? 'forest' : 'gray'}>
                    {field} {col ? `← ${col}` : '· unmapped'}
                  </Badge>
                ))}
              </Group>
            </div>

            {result.errors.length > 0 && (
              <Alert color="red" icon={<IconAlertCircle size={16} />} title="Row errors — nothing was imported">
                <Code block>{JSON.stringify(result.errors, null, 2)}</Code>
              </Alert>
            )}

            {cols.length > 0 && (
              <Table.ScrollContainer minWidth={500}>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      {cols.map((c) => (
                        <Table.Th key={c}>{c}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {result.preview!.map((row, i) => (
                      <Table.Tr key={i}>
                        {cols.map((c) => (
                          <Table.Td key={c}>{row[c]}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {result.row_count} rows in file
              </Text>
              <Group>
                <Button variant="default" onClick={close}>
                  Cancel
                </Button>
                <Button
                  onClick={onCommit}
                  loading={commit.isPending}
                  disabled={result.errors.length > 0 || !result.would_create}
                >
                  Import {result.would_create ?? 0} row(s)
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
