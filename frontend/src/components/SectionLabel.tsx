import { Box, Group, Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface SectionLabelProps {
  children: ReactNode;
  /** Square swatch colour — CSS value. Defaults to forest. */
  color?: string;
}

/** The marketing site's signature eyebrow: a small colour square + an
 *  uppercase, letter-spaced label. Used to title page sections. */
export function SectionLabel({ children, color = 'var(--brand-forest)' }: SectionLabelProps) {
  return (
    <Group gap={8} align="center">
      <Box w={9} h={9} style={{ background: color, borderRadius: 2 }} />
      <Text component="span" tt="uppercase" fz={11} fw={600} c="dimmed" style={{ letterSpacing: '0.12em' }}>
        {children}
      </Text>
    </Group>
  );
}
