import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, actionLabel, onAction, children }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap">
      <Stack gap={2}>
        <Title order={2}>{title}</Title>
        {subtitle && (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        )}
      </Stack>
      {children}
      {actionLabel && onAction && (
        <Button leftSection={<IconPlus size={16} />} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Group>
  );
}
