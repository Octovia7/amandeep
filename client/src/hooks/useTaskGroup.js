import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGroup } from '../features/tasks/tasksSlice';

const GROUP_PAGE_SIZE = 20;

/**
 * One independently paginated group (a Kanban column or a section).
 * Re-fetches page 1 when filters change or any task mutation bumps `version`.
 */
export function useTaskGroup(key, params, enabled = true) {
  const dispatch = useDispatch();
  const group = useSelector((s) => s.tasks.groups[key]);
  const entities = useSelector((s) => s.tasks.entities);
  const version = useSelector((s) => s.tasks.version);
  const query = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) return;
    const p = { ...params, page: 1, limit: GROUP_PAGE_SIZE };
    dispatch(fetchGroup({ key, params: p }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, key, query, version, enabled]);

  const loadMore = useCallback(() => {
    const next = (group?.pagination?.page || 1) + 1;
    dispatch(fetchGroup({ key, params: { ...params, page: next, limit: GROUP_PAGE_SIZE }, append: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, key, query, group?.pagination?.page]);

  const tasks = (group?.ids || []).map((id) => entities[id]).filter(Boolean);
  return { group, tasks, loadMore, retry: () => dispatch(fetchGroup({ key, params: { ...params, page: 1, limit: GROUP_PAGE_SIZE } })) };
}
