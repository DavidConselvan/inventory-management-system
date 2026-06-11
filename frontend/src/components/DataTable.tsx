import { Center, Group, Pagination, Table, Text, TextInput } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSearch } from '@tabler/icons-react';
import { useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string | number;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  searchText,
  searchPlaceholder = 'Search…',
  onRowClick,
  pageSize = 10,
  emptyMessage = 'Nothing here yet.',
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const sortValueFor = (col: Column<T>, row: T) =>
    col.sortValue ? col.sortValue(row) : '';

  const processed = useMemo(() => {
    let rows = data;
    if (searchText && query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => searchText(r).toLowerCase().includes(q));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const av = sortValueFor(col, a);
          const bv = sortValueFor(col, b);
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = processed.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (col: Column<T>) => {
    if (col.sortable === false) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  return (
    <>
      {searchText && (
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setPage(1);
          }}
          mb="sm"
          maw={320}
        />
      )}

      <Table.ScrollContainer minWidth={640}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => {
                const active = sortKey === col.key;
                const sortable = col.sortable !== false && !!col.sortValue;
                return (
                  <Table.Th
                    key={col.key}
                    ta={col.align}
                    onClick={() => sortable && toggleSort(col)}
                    style={{ cursor: sortable ? 'pointer' : undefined, userSelect: 'none' }}
                  >
                    <Group gap={4} justify={col.align === 'right' ? 'flex-end' : 'flex-start'} wrap="nowrap">
                      {col.header}
                      {active &&
                        (sortDir === 'asc' ? (
                          <IconChevronUp size={14} />
                        ) : (
                          <IconChevronDown size={14} />
                        ))}
                    </Group>
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageRows.map((row) => (
              <Table.Tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ cursor: onRowClick ? 'pointer' : undefined }}
              >
                {columns.map((col) => (
                  <Table.Td key={col.key} ta={col.align}>
                    {col.render ? col.render(row) : (row as Record<string, ReactNode>)[col.key]}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
            {processed.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Text c="dimmed" ta="center" py="md">
                    {emptyMessage}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {pageCount > 1 && (
        <Center mt="md">
          <Pagination total={pageCount} value={current} onChange={setPage} size="sm" />
        </Center>
      )}
    </>
  );
}
