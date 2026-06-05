const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });

export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return currencyFmt.format(Number(value));
}

export function qty(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return numberFmt.format(Number(value));
}

export function percent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return `${numberFmt.format(Number(value))}%`;
}
