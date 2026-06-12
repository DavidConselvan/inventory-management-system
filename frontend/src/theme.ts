import {
  Badge,
  Button,
  Card,
  createTheme,
  Paper,
  Table,
  type MantineColorsTuple,
} from '@mantine/core';

const forest: MantineColorsTuple = [
  '#eef5f0',
  '#d8e8de',
  '#b3d2bf',
  '#8bbb9f',
  '#69a784',
  '#519671',
  '#3f8a63',
  '#2f6e4e',
  '#21533a',
  '#123524',
];

// Warm clay — the one accent we allow beside forest, drawn from the brand's
// kraft-paper imagery. Keeps the palette to two families instead of a rainbow.
const clay: MantineColorsTuple = [
  '#fbf3ea',
  '#f1e0cc',
  '#e6c8a6',
  '#dbae7e',
  '#d29a5f',
  '#cd8d4b',
  '#cb863f',
  '#b37231',
  '#a06529',
  '#8b561f',
];

export const theme = createTheme({
  primaryColor: 'forest',
  primaryShade: { light: 9 },
  autoContrast: true,
  colors: { forest, clay },

  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: 'Fraunces, Georgia, "Times New Roman", serif',
    fontWeight: '500',
  },

  components: {
    Card: Card.extend({ defaultProps: { radius: 'md', withBorder: true, shadow: 'none' } }),
    Paper: Paper.extend({ defaultProps: { radius: 'md' } }),
    Button: Button.extend({ defaultProps: { fw: 500 } }),
    // Status pills read as sentence case ("Received", "Confirmed"), not SHOUTING.
    Badge: Badge.extend({ defaultProps: { tt: 'none', fw: 600, radius: 'sm' } }),
    Table: Table.extend({ defaultProps: { verticalSpacing: 'sm', horizontalSpacing: 'md' } }),
  },
});
