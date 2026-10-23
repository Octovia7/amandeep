import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { createSection, deleteSection, renameSection } from '../../features/sections/sectionsSlice';
import { toggleComplete, updateTask } from '../../features/tasks/tasksSlice';
import { openDrawer, pushToast } from '../../features/ui/uiSlice';
import { fmtDate, fmtMinutes, isOverdue } from '../../utils/format';
import { PriorityBadge, SlaBadge, StatusBadge, Tag } from '../common/Badges';
import { ConfirmDialog, ErrorState, Skeleton } from '../common/Feedback';

function TaskRow({ task, sections }) {
  const dispatch = useDispatch();
  const run = async (action, msg) => {
    const res = await dispatch(action);
    dispatch(res.error ? pushToast(res.payload, 'error') : pushToast(msg));
  };
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <input
        type="checkbox"
        className="h-4 w-4 accent-emerald-600"
        aria-label={`Mark ${task.title} complete`}
        checked={task.status === 'Done'}
        onChange={() => run(toggleComplete({ id: task.id, completed: task.status !== 'Done' }), 'Task updated')}
      />
      <button className="min-w-0 flex-1 text-left" onClick={() => dispatch(openDrawer({ taskId: task.id }))}>
        <span className={`block truncate text-sm font-medium ${task.status === 'Done' ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
      </button>
      <PriorityBadge priority={task.priority} compact />
      <StatusBadge status={task.status} />
      <SlaBadge task={task} />
      {task.dueAt && <span className={`text-xs ${isOverdue(task) ? 'font-medium text-red-600' : 'text-slate-500'}`}>{fmtDate(task.dueAt)}</span>}
      {task.estimatedDurationMinutes != null && <span className="text-xs text-slate-500">{fmtMinutes(task.estimatedDurationMinutes)}</span>}
      <span className="hidden gap-1 lg:flex">
        {task.tags?.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </span>
      <select
        aria-label="Move to section"
        className="input w-auto py-0.5 text-xs"
        value={task.sectionId || ''}
        onChange={(e) => run(updateTask({ id: task.id, changes: { sectionId: e.target.value || null } }), 'Task moved')}
      >
        <option value="">No section</option>
        {sections.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
      </select>
    </li>
  );
}

function SectionGroup({ section, params, sections }) {
  const dispatch = useDispatch();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [confirm, setConfirm] = useState(false);
  const id = section._id;
  const { group, tasks, loadMore, retry } = useTaskGroup(`section:${id}`, { ...params, sectionId: id });

  const save = async () => {
    setEditing(false);
    if (!name.trim() || name === section.name) return setName(section.name);
    const res = await dispatch(renameSection({ id, name: name.trim() }));
    dispatch(res.error ? pushToast(res.payload, 'error') : pushToast('Section renamed'));
  };

  return (
    <section className="card">
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <button className="btn-ghost px-1" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed} aria-label={`Toggle ${section.name}`}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        {editing && id !== 'none' ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input className="input py-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus onBlur={save} maxLength={60} />
            <button className="btn-ghost px-1" aria-label="Save name">
              <Check size={14} />
            </button>
          </form>
        ) : (
          <h3 className="font-semibold">{section.name}</h3>
        )}
        <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{group?.pagination?.totalItems ?? '…'}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost px-1.5" aria-label={`Add task to ${section.name}`} onClick={() => dispatch(openDrawer({ defaults: { sectionId: id === 'none' ? '' : id } }))}>
            <Plus size={15} />
          </button>
          {id !== 'none' && (
            <div className="relative">
              <button className="btn-ghost px-1.5" aria-label="Section options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <MoreHorizontal size={15} />
              </button>
              {menu && (
                <div className="card absolute right-0 z-20 mt-1 w-36 py-1 shadow-lg" onMouseLeave={() => setMenu(false)}>
                  <button className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setEditing(true); setMenu(false); }}>
                    <Pencil size={13} /> Rename
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setConfirm(true); setMenu(false); }}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      {!collapsed &&
        (group?.status === 'error' ? (
          <ErrorState message={group.error} onRetry={retry} />
        ) : !group || (group.status === 'loading' && !group.pagination) ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">No tasks in this section.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} sections={sections} />
              ))}
            </ul>
            {group.pagination?.hasNextPage && (
              <button className="w-full py-2 text-sm text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={loadMore} disabled={group.status === 'loadingMore'}>
                {group.status === 'loadingMore' ? 'Loading…' : `Load more (${group.pagination.totalItems - tasks.length} remaining)`}
              </button>
            )}
          </>
        ))}
      <ConfirmDialog
        open={confirm}
        title={`Delete section "${section.name}"?`}
        message="Tasks in this section are kept and moved to “No section”."
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          const res = await dispatch(deleteSection(id));
          dispatch(res.error ? pushToast(res.payload, 'error') : pushToast('Section deleted'));
        }}
      />
    </section>
  );
}

export default function SectionView({ apiParams }) {
  const dispatch = useDispatch();
  const sections = useSelector((s) => s.sections.items);
  const [newName, setNewName] = useState('');
  // sectionId filter is meaningless here (each group sets its own); page/limit are per-group
  const { sectionId, page, limit, ...params } = apiParams; // eslint-disable-line no-unused-vars

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await dispatch(createSection(newName.trim()));
    if (res.error) return dispatch(pushToast(res.payload, 'error'));
    setNewName('');
    dispatch(pushToast('Section created'));
  };

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <SectionGroup key={s._id} section={s} params={params} sections={sections} />
      ))}
      <SectionGroup key="none" section={{ _id: 'none', name: 'No section' }} params={params} sections={sections} />
      <form onSubmit={add} className="flex gap-2">
        <input className="input max-w-xs" placeholder="New section name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} aria-label="New section name" />
        <button className="btn-outline">
          <Plus size={15} /> Add section
        </button>
      </form>
    </div>
  );
}
