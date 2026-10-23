import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowDown, ArrowUp, Pencil, Trash2, CheckSquare } from 'lucide-react';
import { fetchTasks, toggleComplete, updateTask, deleteTask, bulkUpdate, toggleSelected, setSelected } from '../../features/tasks/tasksSlice';
import { openDrawer, pushToast } from '../../features/ui/uiSlice';
import { STATUSES, PRIORITIES, fmtDateTime, fmtDate, fmtMinutes, isOverdue } from '../../utils/format';
import { SlaBadge, Tag } from '../common/Badges';
import { ConfirmDialog, EmptyState, ErrorState, SkeletonRows } from '../common/Feedback';
import Pagination from '../pagination/Pagination';

const COLUMNS = [
  ['title', 'Task', 'title'],
  ['status', 'Status', 'status'],
  ['priority', 'Priority', 'priority'],
  ['startAt', 'Start', 'startAt'],
  ['dueAt', 'Due', 'dueAt'],
  ['est', 'Est.', 'duration'],
  ['actual', 'Actual', 'actualDurationMinutes'],
  ['sla', 'SLA', 'sla'],
  ['tags', 'Tags', null],
  ['createdAt', 'Created', 'createdAt'],
];

export default function ListView({ apiParams, params, setFilter }) {
  const dispatch = useDispatch();
  const { list, entities, selected, version } = useSelector((s) => s.tasks);
  const [confirm, setConfirm] = useState(null);
  const query = JSON.stringify(apiParams);

  useEffect(() => {
    dispatch(fetchTasks(apiParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, query, version]);

  const tasks = list.ids.map((id) => entities[id]).filter(Boolean);
  const allSelected = tasks.length > 0 && tasks.every((t) => selected.includes(t.id));

  const run = async (action, success) => {
    const res = await dispatch(action);
    dispatch(res.error ? pushToast(res.payload, 'error') : pushToast(success));
  };

  const sortBy = params.sortBy || 'createdAt';
  const order = params.order || 'desc';
  const onSort = (key) => setFilter({ sortBy: key, order: sortBy === key && order === 'asc' ? 'desc' : 'asc' });

  if (list.status === 'error' && !tasks.length) return <ErrorState message={list.error} onRetry={() => dispatch(fetchTasks(apiParams))} />;
  if (list.status === 'loading' && !list.pagination) return <SkeletonRows rows={8} />;

  return (
    <div className="card overflow-hidden">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-indigo-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-indigo-950/40">
          <span className="font-medium">{selected.length} selected</span>
          <button className="btn-outline py-1" onClick={() => run(bulkUpdate({ ids: selected, action: 'complete' }), 'Tasks completed')}>
            <CheckSquare size={14} /> Complete
          </button>
          <select
            className="input w-auto py-1"
            value=""
            aria-label="Set status for selected"
            onChange={(e) => e.target.value && run(bulkUpdate({ ids: selected, action: 'update', changes: { status: e.target.value } }), 'Status updated')}
          >
            <option value="">Set status…</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            className="input w-auto py-1"
            value=""
            aria-label="Set priority for selected"
            onChange={(e) => e.target.value && run(bulkUpdate({ ids: selected, action: 'update', changes: { priority: e.target.value } }), 'Priority updated')}
          >
            <option value="">Set priority…</option>
            {PRIORITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn-danger py-1" onClick={() => setConfirm({ bulk: true })}>
            <Trash2 size={14} /> Delete
          </button>
          <button className="btn-ghost py-1" onClick={() => dispatch(setSelected([]))}>
            Clear
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks match"
          description="Try adjusting your filters, or create a new task."
          action={
            <button className="btn-primary" onClick={() => dispatch(openDrawer())}>
              New task
            </button>
          }
        />
      ) : (
        <div className={`overflow-x-auto ${list.status === 'loading' ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allSelected}
                    onChange={() => dispatch(setSelected(allSelected ? [] : tasks.map((t) => t.id)))}
                  />
                </th>
                <th className="w-8 px-1 py-2">
                  <span className="sr-only">Done</span>
                </th>
                {COLUMNS.map(([key, label, sortKey]) => (
                  <th key={key} className="px-3 py-2 font-medium" aria-sort={sortKey && sortBy === sortKey ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {sortKey ? (
                      <button className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200" onClick={() => onSort(sortKey)}>
                        {label}
                        {sortBy === sortKey && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                ))}
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Select ${t.title}`} checked={selected.includes(t.id)} onChange={() => dispatch(toggleSelected(t.id))} />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-full accent-emerald-600"
                      aria-label={`Mark ${t.title} ${t.status === 'Done' ? 'incomplete' : 'complete'}`}
                      checked={t.status === 'Done'}
                      onChange={() => run(toggleComplete({ id: t.id, completed: t.status !== 'Done' }), t.status === 'Done' ? 'Task reopened' : 'Task completed')}
                    />
                  </td>
                  <td className="max-w-xs px-3 py-2">
                    <button className="block max-w-full text-left" onClick={() => dispatch(openDrawer({ taskId: t.id }))}>
                      <span className={`block truncate font-medium hover:text-indigo-600 ${t.status === 'Done' ? 'text-slate-400 line-through' : ''}`}>{t.title}</span>
                      {t.description && <span className="block truncate text-xs text-slate-500">{t.description.split('\n')[0]}</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label="Status"
                      className="input w-32 py-1 text-xs"
                      value={t.status}
                      onChange={(e) => run(updateTask({ id: t.id, changes: { status: e.target.value } }), 'Status updated')}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label="Priority"
                      className="input w-24 py-1 text-xs"
                      value={t.priority}
                      onChange={(e) => run(updateTask({ id: t.id, changes: { priority: e.target.value } }), 'Priority updated')}
                    >
                      {PRIORITIES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDateTime(t.startAt)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-xs ${isOverdue(t) ? 'font-medium text-red-600' : ''}`}>{fmtDateTime(t.dueAt)}</td>
                  <td className="px-3 py-2 text-xs">{fmtMinutes(t.estimatedDurationMinutes)}</td>
                  <td className="px-3 py-2 text-xs">{fmtMinutes(t.actualDurationMinutes)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <SlaBadge task={t} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.tags?.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmtDate(t.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button className="btn-ghost px-1.5" aria-label={`Edit ${t.title}`} onClick={() => dispatch(openDrawer({ taskId: t.id }))}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost px-1.5 text-red-600" aria-label={`Delete ${t.title}`} onClick={() => setConfirm({ id: t.id })}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        pagination={list.pagination}
        onPage={(page) => setFilter({ page }, { resetPage: false })}
        onLimit={(limit) => setFilter({ limit })}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.bulk ? `Delete ${selected.length} tasks?` : 'Delete task?'}
        message="Deleted tasks are removed from all views."
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c.bulk) run(bulkUpdate({ ids: selected, action: 'delete' }), 'Tasks deleted');
          else run(deleteTask(c.id), 'Task deleted');
        }}
      />
    </div>
  );
}
