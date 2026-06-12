import { Badge, Card, Group, SegmentedControl, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { AreaChart, BarChart } from '@mantine/charts';
import {
  IconCash,
  IconCoin,
  IconPackage,
  IconReceiptTax,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useDashboard } from '../api/dashboard';
import type { TrendPoint } from '../api/types';
import { QueryBoundary } from '../components/QueryBoundary';
import { SectionLabel } from '../components/SectionLabel';
import { StatCard } from '../components/StatCard';
import { money, moneyCompact, percent, qty } from '../lib/format';

type Metric = 'revenue' | 'cogs' | 'profit' | 'margin';

const METRICS: Record<
  Metric,
  { label: string; color: string; value: (t: TrendPoint) => number; fmt: (v: number) => string; axis: (v: number) => string }
> = {
  revenue: { label: 'Revenue', color: '#519671', value: (t) => Number(t.revenue), fmt: money, axis: moneyCompact },
  cogs: { label: 'COGS', color: '#cb863f', value: (t) => Number(t.cogs), fmt: money, axis: moneyCompact },
  profit: { label: 'Profit', color: '#123524', value: (t) => Number(t.profit), fmt: money, axis: moneyCompact },
  margin: {
    label: 'Margin',
    color: '#3f8a63',
    value: (t) => (t.margin_percent === null ? 0 : Number(t.margin_percent)),
    fmt: (v) => percent(v),
    axis: (v) => `${v}%`,
  },
};

export function DashboardPage() {
  const query = useDashboard();
  const d = query.data;
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>('profit');

  const chartData =
    d?.products
      .map((p) => ({
        name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
        Revenue: Number(p.revenue),
        COGS: Number(p.cogs),
        Profit: Number(p.profit),
      }))
      .filter((p) => p.Revenue > 0 || p.COGS > 0) ?? [];

  const trend = d?.trend ?? [];
  const spark = (m: Metric) => trend.map(METRICS[m].value);
  const active = METRICS[metric];
  const trendData = trend.map((t) => ({ label: t.label, value: active.value(t) }));

  return (
    <Stack gap="xl">
      <div>
        <SectionLabel>Overview</SectionLabel>
        <Title order={2} mt="xs">
          Profit at a <span className="accent">glance</span>
        </Title>
        <Text c="dimmed" size="sm" mt={4}>
          Revenue, cost of goods sold, and margin across your catalog.
        </Text>
      </div>

      <QueryBoundary isLoading={query.isLoading} isError={query.isError} error={query.error}>
        {d && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <StatCard
                label="Total Revenue"
                value={money(d.totals.revenue)}
                icon={IconCash}
                spark={spark('revenue')}
                sparkColor={METRICS.revenue.color}
                active={metric === 'revenue'}
                onClick={() => setMetric('revenue')}
              />
              <StatCard
                label="Cost of Goods Sold"
                value={money(d.totals.cogs)}
                icon={IconReceiptTax}
                spark={spark('cogs')}
                sparkColor={METRICS.cogs.color}
                active={metric === 'cogs'}
                onClick={() => setMetric('cogs')}
              />
              <StatCard
                label="Profit"
                value={money(d.totals.profit)}
                icon={IconTrendingUp}
                spark={spark('profit')}
                sparkColor={METRICS.profit.color}
                active={metric === 'profit'}
                onClick={() => setMetric('profit')}
              />
              <StatCard
                label="Profit Margin"
                value={percent(d.totals.margin_percent)}
                icon={IconCoin}
                spark={spark('margin')}
                sparkColor={METRICS.margin.color}
                active={metric === 'margin'}
                onClick={() => setMetric('margin')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <StatCard
                label="Total Purchased"
                value={money(d.totals.purchased_cost)}
                icon={IconCoin}
                hint={`${qty(d.totals.purchased_quantity)} units bought`}
              />
              <StatCard
                label="Inventory on Hand"
                value={money(d.totals.inventory_value)}
                icon={IconPackage}
                hint={`${qty(d.totals.quantity_on_hand)} units in stock`}
              />
              <StatCard
                label="Products"
                value={String(d.product_count)}
                icon={IconPackage}
                hint={`${d.purchase_order_count} POs · ${d.sales_order_count} sales`}
              />
            </SimpleGrid>

            {trend.length > 1 && (
              <Card withBorder p="lg">
                <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
                  <div>
                    <SectionLabel color="var(--brand-clay)">Trend</SectionLabel>
                    <Title order={4} mt="xs" fw={500}>
                      {active.label} over time
                    </Title>
                  </div>
                  <SegmentedControl
                    size="xs"
                    value={metric}
                    onChange={(v) => setMetric(v as Metric)}
                    data={[
                      { label: 'Revenue', value: 'revenue' },
                      { label: 'COGS', value: 'cogs' },
                      { label: 'Profit', value: 'profit' },
                      { label: 'Margin', value: 'margin' },
                    ]}
                  />
                </Group>
                <AreaChart
                  h={280}
                  data={trendData}
                  dataKey="label"
                  series={[{ name: 'value', label: active.label, color: active.color }]}
                  curveType="monotone"
                  withGradient
                  fillOpacity={0.18}
                  valueFormatter={active.fmt}
                  tickLine="none"
                  gridAxis="y"
                  gridProps={{ stroke: 'var(--mantine-color-gray-3)' }}
                  yAxisProps={{ width: 56, tickFormatter: active.axis }}
                />
              </Card>
            )}

            <Card withBorder p="lg">
              <SectionLabel color="var(--brand-clay)">Margin by product</SectionLabel>
              <Title order={4} mt="xs" mb="lg" fw={500}>
                Revenue vs. cost
              </Title>
              {chartData.length ? (
                <BarChart
                  h={320}
                  data={chartData}
                  dataKey="name"
                  series={[
                    { name: 'Revenue', color: '#519671' },
                    { name: 'COGS', color: '#cb863f' },
                    { name: 'Profit', color: '#123524' },
                  ]}
                  valueFormatter={(v) => money(v)}
                  withLegend
                  gridAxis="y"
                  barProps={{ radius: [3, 3, 0, 0] }}
                  tickLine="none"
                  gridProps={{ stroke: 'var(--mantine-color-gray-3)' }}
                  yAxisProps={{ width: 52, tickFormatter: moneyCompact }}
                />
              ) : (
                <Text c="dimmed" size="sm">
                  No sales yet — create a sales order to see profit here.
                </Text>
              )}
            </Card>

            <Card withBorder p="lg">
              <SectionLabel>By product</SectionLabel>
              <Title order={4} mt="xs" mb="md" fw={500}>
                Per-product breakdown
              </Title>
              <Table.ScrollContainer minWidth={760}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>On hand</Table.Th>
                      <Table.Th ta="right">Revenue</Table.Th>
                      <Table.Th ta="right">COGS</Table.Th>
                      <Table.Th ta="right">Profit</Table.Th>
                      <Table.Th ta="right">Margin</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {d.products.map((p) => (
                      <Table.Tr
                        key={p.id}
                        onClick={() => navigate(`/products/${p.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Table.Td>
                          <Text fw={500}>{p.name}</Text>
                          <Text size="xs" c="dimmed">
                            {p.sku}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {qty(p.quantity_on_hand)} {p.unit.toLowerCase()}
                        </Table.Td>
                        <Table.Td ta="right" className="tnum">{money(p.revenue)}</Table.Td>
                        <Table.Td ta="right" className="tnum">{money(p.cogs)}</Table.Td>
                        <Table.Td ta="right" className="tnum">{money(p.profit)}</Table.Td>
                        <Table.Td ta="right">
                          {p.margin_percent === null ? (
                            <Text c="dimmed">—</Text>
                          ) : (
                            <Badge color={Number(p.profit) >= 0 ? 'forest' : 'red'} variant="light">
                              {percent(p.margin_percent)}
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {d.products.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text c="dimmed" ta="center" py="md">
                            No products yet.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          </>
        )}
      </QueryBoundary>
    </Stack>
  );
}
