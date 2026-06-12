import { useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';

import type { ListParams } from '../api/types';

interface Options {
  /** Default ordering field, e.g. "name" or "-order_date". */
  ordering: string;
  pageSize?: number;
  /** Filter values (e.g. { unit, status }). Changing any resets to page 1. */
  filters?: Record<string, string | undefined>;
}

/**
 * Search / ordering / paging state for a server-driven table. Debounces the
 * search box, toggles a column's ordering asc⇄desc, and resets to page 1
 * whenever the search, ordering or any filter changes.
 */
export function useListControls({ ordering: initialOrdering, pageSize = 10, filters = {} }: Options) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const [ordering, setOrdering] = useState(initialOrdering);
  const [page, setPage] = useState(1);

  // When the result set changes (search / ordering / filters), jump back to
  // page 1. Adjusting state during render is React's recommended alternative to
  // doing this in an effect (no extra commit, no cascading render).
  const resetKey = JSON.stringify([debounced, ordering, filters]);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setPage(1);
  }

  const onOrder = (field: string) =>
    setOrdering((current) => (current === field ? `-${field}` : field));

  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v != null && v !== ''),
  );

  const params: ListParams = {
    ordering,
    page,
    page_size: pageSize,
    ...(debounced.trim() ? { search: debounced.trim() } : {}),
    ...cleanFilters,
  };

  return { params, search, setSearch, ordering, onOrder, page, setPage, pageSize };
}
