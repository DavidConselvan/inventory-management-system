import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';

interface ConfirmDeleteOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

/** Themed replacement for window.confirm() for destructive actions. */
export function confirmDelete({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
}: ConfirmDeleteOptions) {
  modals.openConfirmModal({
    title,
    centered: true,
    children: <Text size="sm">{message}</Text>,
    labels: { confirm: confirmLabel, cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm,
  });
}
