import { Card, createTheme, Paper, type MantineColorsTuple } from '@mantine/core';

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

export const theme = createTheme({
  primaryColor: 'forest',
  primaryShade: { light: 9 },
  autoContrast: true,
  colors: { forest },

  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: 'Fraunces, Georgia, "Times New Roman", serif',
    fontWeight: '500',
  },

  components: {
    Card: Card.extend({ defaultProps: { radius: 'lg', withBorder: true } }),
    Paper: Paper.extend({ defaultProps: { radius: 'lg' } }),
  },
});
