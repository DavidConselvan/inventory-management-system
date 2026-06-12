import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { SectionLabel } from './SectionLabel';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actionLabel, onAction, children }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" mb="xl" wrap="wrap">
      <Stack gap={6}>
        {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
        <Title order={2}>{title}</Title>
        {subtitle && (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        )}
      </Stack>
      <Group gap="xs" wrap="wrap">
        {children}
        {actionLabel && onAction && (
          <Button leftSection={<IconPlus size={16} />} onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Group>
    </Group>
  );
}
