import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Keys that are UI-only and never sent to the API. */
const UI_KEYS = ['mode'];

/**
 * Filters, sorting and pagination live in the URL so they survive reloads and can be shared.
 * Any filter change resets the page to 1.
 */
export function useTaskFilters(view) {
  const [params, setParams] = useSearchParams();

  const all = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const apiParams = useMemo(() => {
    const p = { ...all };
    UI_KEYS.forEach((k) => delete p[k]);
    if (view && view !== 'all') p.view = view;
    return p;
  }, [all, view]);

  const setFilter = useCallback(
    (updates, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates)) {
            if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) next.delete(k);
            else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
          }
          if (resetPage && !('page' in updates)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const clearFilters = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams();
      for (const k of ['mode', 'limit', 'sortBy', 'order']) if (prev.get(k)) next.set(k, prev.get(k));
      return next;
    });
  }, [setParams]);

  return { params: all, apiParams, setFilter, clearFilters, mode: all.mode || 'list' };
}

export const listParam = (v) => (v ? v.split(',').filter(Boolean) : []);
