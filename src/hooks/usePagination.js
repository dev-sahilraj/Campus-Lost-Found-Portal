import { useState, useMemo } from 'react';

/**
 * usePagination — manages page-based slicing of any data array
 * @param {Array}  data      - full data array
 * @param {number} pageSize  - items per page (default 12)
 */
export const usePagination = (data = [], pageSize = 12) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Reset to page 1 if data changes (e.g. filter applied)
  // We do this via memo comparison in the component
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const goTo    = (p) => setPage(Math.max(1, Math.min(p, totalPages)));
  const next    = () => goTo(page + 1);
  const prev    = () => goTo(page - 1);
  const reset   = () => setPage(1);

  return { paged, page, totalPages, goTo, next, prev, reset, hasNext: page < totalPages, hasPrev: page > 1 };
};
