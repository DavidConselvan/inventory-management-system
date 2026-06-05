import { Group, Paper, Text, ThemeIcon } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: Icon;
  color?: string;
  hint?: string;
}

export function StatCard({ label, value, icon: IconCmp, color = 'blue', hint }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {label}
          </Text>
          <Text size="xl" fw={700} mt={4}>
            {value}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" mt={2}>
              {hint}
            </Text>
          )}
        </div>
        <ThemeIcon color={color} variant="light" size={42} radius="md">
          <IconCmp size={24} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
