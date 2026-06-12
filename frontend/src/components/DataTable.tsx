import { Center, Group, Loader, Pagination, Table, Text, TextInput } from '@mantine/core';
import { IconArrowsSort, IconChevronDown, IconChevronUp, IconSearch } from '@tabler/icons-react';
import { useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Client-side sort accessor. */
  sortValue?: (row: T) => string | number;
  /** Server-side ordering field name; makes the column sortable in server mode. */
  sortField?: string;
  align?: 'left' | 'right';
  sortable?: boolean;
}

/** Controlled state for a server-driven table (search/ordering/paging live on the page). */
export interface ServerControls {
  search: string;
  onSearch: (value: string) => void;
  ordering: string;
  onOrder: (field: string) => void;
  page: number;
  onPage: (page: number) => void;
  total: number;
  pageSize: number;
  loading?: boolean;
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
  /** Provide to drive search/sort/paging from the server instead of the client. */
  server?: ServerControls;
  /** Filter controls rendered alongside the search box. */
  filters?: ReactNode;
}

function SortIcon({ state }: { state: 'asc' | 'desc' | 'none' }) {
  if (state === 'asc') return <IconChevronUp size={14} color="var(--brand-forest)" />;
  if (state === 'desc') return <IconChevronDown size={14} color="var(--brand-forest)" />;
  // Sortable but inactive — a faint hint that the column can be sorted.
  return <IconArrowsSort size={13} color="var(--mantine-color-gray-5)" />;
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
  server,
  filters,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const processed = useMemo(() => {
    if (server) return data; // server already searched + sorted
    let rows = data;
    if (searchText && query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => searchText(r).toLowerCase().includes(q));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        rows = [...rows].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, sortKey, sortDir, server]);

  const pageCount = server
    ? Math.max(1, Math.ceil(server.total / server.pageSize))
    : Math.max(1, Math.ceil(processed.length / pageSize));
  const current = server ? server.page : Math.min(page, pageCount);
  const pageRows = server ? data : processed.slice((current - 1) * pageSize, current * pageSize);

  const sortStateFor = (col: Column<T>): 'asc' | 'desc' | 'none' => {
    if (server) {
      if (server.ordering === col.sortField) return 'asc';
      if (server.ordering === `-${col.sortField}`) return 'desc';
      return 'none';
    }
    if (sortKey !== col.key) return 'none';
    return sortDir;
  };

  const isSortable = (col: Column<T>) =>
    server ? !!col.sortField : col.sortable !== false && !!col.sortValue;

  const toggleSort = (col: Column<T>) => {
    if (!isSortable(col)) return;
    if (server) {
      server.onOrder(col.sortField!);
    } else if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const showSearch = server ? true : !!searchText;
  const searchValue = server ? server.search : query;
  const onSearchChange = (v: string) => {
    if (server) server.onSearch(v);
    else {
      setQuery(v);
      setPage(1);
    }
  };

  return (
    <>
      {(showSearch || filters) && (
        <Group justify="space-between" align="center" mb="sm" gap="sm" wrap="wrap">
          <Group gap="sm" align="center">
            {showSearch && (
              <TextInput
                placeholder={searchPlaceholder}
                leftSection={<IconSearch size={16} />}
                value={searchValue}
                onChange={(e) => onSearchChange(e.currentTarget.value)}
                w={280}
              />
            )}
            {server?.loading && <Loader size="xs" />}
          </Group>
          {filters && (
            <Group gap="sm" align="center">
              {filters}
            </Group>
          )}
        </Group>
      )}

      <Table.ScrollContainer minWidth={640}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => {
                const sortable = isSortable(col);
                return (
                  <Table.Th
                    key={col.key}
                    ta={col.align}
                    onClick={() => toggleSort(col)}
                    style={{ cursor: sortable ? 'pointer' : undefined, userSelect: 'none' }}
                  >
                    <Group gap={4} justify={col.align === 'right' ? 'flex-end' : 'flex-start'} wrap="nowrap">
                      {col.header}
                      {sortable && <SortIcon state={sortStateFor(col)} />}
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
            {pageRows.length === 0 && (
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
          <Pagination
            total={pageCount}
            value={current}
            onChange={server ? server.onPage : setPage}
            size="sm"
          />
        </Center>
      )}
    </>
  );
}
