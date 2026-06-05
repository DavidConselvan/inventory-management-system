import {
  Badge,
  Card,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { BarChart } from '@mantine/charts';
import {
  IconCash,
  IconCoin,
  IconPackage,
  IconReceiptTax,
  IconTrendingUp,
} from '@tabler/icons-react';

import { useDashboard } from '../api/dashboard';
import { QueryBoundary } from '../components/QueryBoundary';
import { StatCard } from '../components/StatCard';
import { money, percent, qty } from '../lib/format';

export function DashboardPage() {
  const query = useDashboard();
  const d = query.data;

  const chartData =
    d?.products
      .map((p) => ({
        name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
        Revenue: Number(p.revenue),
        COGS: Number(p.cogs),
        Profit: Number(p.profit),
      }))
      .filter((p) => p.Revenue > 0 || p.COGS > 0) ?? [];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed" size="sm">
          Profit analysis across your products
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
                color="teal"
              />
              <StatCard
                label="Cost of Goods Sold"
                value={money(d.totals.cogs)}
                icon={IconReceiptTax}
                color="orange"
              />
              <StatCard
                label="Profit"
                value={money(d.totals.profit)}
                icon={IconTrendingUp}
                color="green"
              />
              <StatCard
                label="Profit Margin"
                value={percent(d.totals.margin_percent)}
                icon={IconCoin}
                color="grape"
                hint="Profit ÷ COGS"
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <StatCard
                label="Total Purchased"
                value={money(d.totals.purchased_cost)}
                icon={IconCoin}
                color="blue"
                hint={`${qty(d.totals.purchased_quantity)} units bought`}
              />
              <StatCard
                label="Inventory on Hand"
                value={money(d.totals.inventory_value)}
                icon={IconPackage}
                color="cyan"
                hint={`${qty(d.totals.quantity_on_hand)} units in stock`}
              />
              <StatCard
                label="Products"
                value={String(d.product_count)}
                icon={IconPackage}
                color="indigo"
                hint={`${d.purchase_order_count} POs · ${d.sales_order_count} sales`}
              />
            </SimpleGrid>

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                Revenue vs. cost by product
              </Title>
              {chartData.length ? (
                <BarChart
                  h={320}
                  data={chartData}
                  dataKey="name"
                  series={[
                    { name: 'Revenue', color: 'teal.6' },
                    { name: 'COGS', color: 'orange.6' },
                    { name: 'Profit', color: 'green.6' },
                  ]}
                  valueFormatter={(v) => money(v)}
                  withLegend
                />
              ) : (
                <Text c="dimmed" size="sm">
                  No sales yet — create a sales order to see profit here.
                </Text>
              )}
            </Card>

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                Per-product breakdown
              </Title>
              <Table.ScrollContainer minWidth={760}>
                <Table striped highlightOnHover>
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
                      <Table.Tr key={p.id}>
                        <Table.Td>
                          <Text fw={500}>{p.name}</Text>
                          <Text size="xs" c="dimmed">
                            {p.sku}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {qty(p.quantity_on_hand)} {p.unit.toLowerCase()}
                        </Table.Td>
                        <Table.Td ta="right">{money(p.revenue)}</Table.Td>
                        <Table.Td ta="right">{money(p.cogs)}</Table.Td>
                        <Table.Td ta="right">{money(p.profit)}</Table.Td>
                        <Table.Td ta="right">
                          {p.margin_percent === null ? (
                            <Text c="dimmed">—</Text>
                          ) : (
                            <Badge color={Number(p.profit) >= 0 ? 'green' : 'red'} variant="light">
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
