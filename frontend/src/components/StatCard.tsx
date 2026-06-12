import { Group, Paper, Text } from '@mantine/core';
import { Sparkline } from '@mantine/charts';
import type { Icon } from '@tabler/icons-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: Icon;
  hint?: string;
  /** Tiny inline trend under the value. */
  spark?: number[];
  sparkColor?: string;
  /** When provided, the card becomes a clickable control (focuses the chart). */
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({
  label,
  value,
  icon: IconCmp,
  hint,
  spark,
  sparkColor = 'forest.6',
  onClick,
  active,
}: StatCardProps) {
  return (
    <Paper
      withBorder
      p="lg"
      radius="md"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        borderColor: active ? 'var(--brand-forest)' : undefined,
        boxShadow: active ? 'inset 0 0 0 1px var(--brand-forest)' : undefined,
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
    >
      <Group justify="space-between" align="center" mb="sm" wrap="nowrap">
        <Text tt="uppercase" fz={11} fw={600} c="dimmed" style={{ letterSpacing: '0.1em' }}>
          {label}
        </Text>
        <IconCmp size={16} stroke={1.5} color="var(--brand-muted)" />
      </Group>
      <Text ff="heading" fz={30} fw={500} lh={1.05} className="tnum">
        {value}
      </Text>
      {spark && spark.length > 1 ? (
        <Sparkline
          mt="sm"
          h={30}
          data={spark}
          curveType="monotone"
          color={sparkColor}
          fillOpacity={0.12}
          strokeWidth={1.5}
        />
      ) : (
        hint && (
          <Text size="xs" c="dimmed" mt={8}>
            {hint}
          </Text>
        )
      )}
    </Paper>
  );
}
