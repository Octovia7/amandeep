import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Trash2, History } from 'lucide-react';
import { closeDrawer, pushToast } from '../../features/ui/uiSlice';
import { createTask, deleteTask, fetchTask, updateTask } from '../../features/tasks/tasksSlice';
import { STATUSES, PRIORITIES, fmtDateTime, fmtMinutes, fromNow, toInputDateTime, fromInputDateTime } from '../../utils/format';
import { SlaBadge } from '../common/Badges';
import { ConfirmDialog, Skeleton } from '../common/Feedback';

const EMPTY = {
  title: '',
  description: '',
  status: 'To Do',
  priority: 'Medium',
  startAt: '',
  dueAt: '',
  estimatedDurationMinutes: '',
  actualDurationMinutes: '',
  timeSpentMinutes: '',
  slaDurationMinutes: '',
  sectionId: '',
  tags: '',
};

const toForm = (t) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, t[k] ?? EMPTY[k]])),
  startAt: toInputDateTime(t.startAt),
  dueAt: toInputDateTime(t.dueAt),
  tags: (t.tags || []).join(', '),
  sectionId: t.sectionId?._id || t.sectionId || '',
});

/** Frontend validation mirrors the server rules; the server remains the source of truth. */
export function validateTask(f) {
  const errors = {};
  if (!f.title.trim()) errors.title = 'Title is required';
  if (f.title.length > 200) errors.title = 'Title must be at most 200 characters';
  for (const k of ['estimatedDurationMinutes', 'actualDurationMinutes', 'timeSpentMinutes', 'slaDurationMinutes']) {
    if (f[k] !== '' && (!Number.isInteger(Number(f[k])) || Number(f[k]) < 0)) errors[k] = 'Must be a whole number ≥ 0';
  }
  if (f.startAt && f.dueAt && new Date(f.dueAt) < new Date(f.startAt)) errors.dueAt = 'Due date must be after start date';
  return errors;
}

function toPayload(f) {
  const num = (v) => (v === '' ? null : Number(v));
  return {
    title: f.title.trim(),
    description: f.description,
    status: f.status,
    priority: f.priority,
    startAt: fromInputDateTime(f.startAt),
    dueAt: fromInputDateTime(f.dueAt),
    estimatedDurationMinutes: num(f.estimatedDurationMinutes),
    actualDurationMinutes: num(f.actualDurationMinutes),
    timeSpentMinutes: num(f.timeSpentMinutes) ?? 0,
    slaDurationMinutes: num(f.slaDurationMinutes),
    sectionId: f.sectionId || null,
    tags: f.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

function Field({ label, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-0.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export default function TaskDrawer() {
  const dispatch = useDispatch();
  const { open, taskId, defaults } = useSelector((s) => s.ui.drawer);
  const task = useSelector((s) => (taskId ? s.tasks.entities[taskId] : null));
  const sections = useSelector((s) => s.sections.items);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (taskId) {
      setLoaded(false);
      dispatch(fetchTask(taskId)).finally(() => setLoaded(true));
    } else {
      const statusSection = sections.find((s) => s.name === (defaults?.status || 'To Do'));
      setForm({ ...EMPTY, sectionId: statusSection?._id || '', ...defaults });
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  useEffect(() => {
    if (open && taskId && task && loaded) setForm(toForm(task));
  }, [open, taskId, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !confirm && dispatch(closeDrawer());
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, confirm, dispatch]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validateTask(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const action = taskId ? updateTask({ id: taskId, changes: toPayload(form) }) : createTask(toPayload(form));
    const res = await dispatch(action);
    setSaving(false);
    if (res.error) return dispatch(pushToast(res.payload, 'error'));
    dispatch(pushToast(taskId ? 'Task updated' : 'Task created'));
    dispatch(closeDrawer());
  }

  async function onDelete() {
    setConfirm(false);
    const res = await dispatch(deleteTask(taskId));
    if (res.error) return dispatch(pushToast(res.payload, 'error'));
    dispatch(pushToast('Task deleted'));
    dispatch(closeDrawer());
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={() => dispatch(closeDrawer())} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={taskId ? 'Task details' : 'New task'}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{taskId ? 'Task details' : 'New task'}</h2>
            {task && <SlaBadge task={task} />}
          </div>
          <div className="flex items-center gap-1">
            {taskId && (
              <button className="btn-ghost text-red-600" onClick={() => setConfirm(true)} aria-label="Delete task">
                <Trash2 size={16} />
              </button>
            )}
            <button className="btn-ghost" onClick={() => dispatch(closeDrawer())} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        {!loaded ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-9" />
            <Skeleton className="h-24" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden" noValidate>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <Field label="Title *" error={errors.title}>
                <input className="input" value={form.title} onChange={set('title')} autoFocus maxLength={200} />
              </Field>
              <Field label="Description">
                <textarea className="input min-h-[96px]" value={form.description} onChange={set('description')} />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Status">
                  <select className="input" value={form.status} onChange={set('status')}>
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className="input" value={form.priority} onChange={set('priority')}>
                    {PRIORITIES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Section">
                  <select className="input" value={form.sectionId} onChange={set('sectionId')}>
                    <option value="">No section</option>
                    {sections.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start" className="col-span-2 sm:col-span-1" error={errors.startAt}>
                  <input type="datetime-local" className="input" value={form.startAt} onChange={set('startAt')} />
                </Field>
                <Field label="Due" className="col-span-2 sm:col-span-1" error={errors.dueAt}>
                  <input type="datetime-local" className="input" value={form.dueAt} onChange={set('dueAt')} />
                </Field>
                <Field label="SLA (minutes)" error={errors.slaDurationMinutes}>
                  <input type="number" min="0" className="input" value={form.slaDurationMinutes} onChange={set('slaDurationMinutes')} />
                </Field>
                <Field label="Estimate (min)" error={errors.estimatedDurationMinutes}>
                  <input type="number" min="0" className="input" value={form.estimatedDurationMinutes} onChange={set('estimatedDurationMinutes')} />
                </Field>
                <Field label="Actual (min)" error={errors.actualDurationMinutes}>
                  <input type="number" min="0" className="input" value={form.actualDurationMinutes} onChange={set('actualDurationMinutes')} />
                </Field>
                <Field label="Time spent (min)" error={errors.timeSpentMinutes}>
                  <input type="number" min="0" className="input" value={form.timeSpentMinutes} onChange={set('timeSpentMinutes')} />
                </Field>
              </div>
              <Field label="Tags (comma separated)">
                <input className="input" value={form.tags} onChange={set('tags')} placeholder="frontend, urgent" />
              </Field>

              {task && (
                <section className="space-y-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                  <div className="grid grid-cols-2 gap-1">
                    <span>Created: {fmtDateTime(task.createdAt)}</span>
                    <span>Updated: {fmtDateTime(task.updatedAt)}</span>
                    <span>Created by: {task.createdBy?.name || '—'}</span>
                    <span>Assignee: {task.assignee?.name || 'Unassigned'}</span>
                    <span>SLA deadline: {fmtDateTime(task.sla?.deadline)}</span>
                    <span>Completed: {fmtDateTime(task.completedAt)}</span>
                    {task.slaDurationMinutes ? <span>SLA target: {fmtMinutes(task.slaDurationMinutes)}</span> : null}
                  </div>
                  {task.activity?.length > 0 && (
                    <div>
                      <h3 className="mb-1 flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <History size={13} /> Activity
                      </h3>
                      <ol className="max-h-40 space-y-1 overflow-y-auto">
                        {[...task.activity].reverse().map((a, i) => (
                          <li key={i}>
                            <span className="font-medium">{a.by?.name || 'Someone'}</span>{' '}
                            {a.type === 'created' ? 'created this task' : `changed ${a.field}`}
                            {a.type !== 'created' && ['status', 'priority', 'title'].includes(a.field) && (
                              <>
                                {' '}
                                from <em>{String(a.from ?? '—')}</em> to <em>{String(a.to ?? '—')}</em>
                              </>
                            )}{' '}
                            <span className="text-slate-400">· {fromNow(a.at)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </section>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
              <button type="button" className="btn-ghost" onClick={() => dispatch(closeDrawer())}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : taskId ? 'Save changes' : 'Create task'}
              </button>
            </footer>
          </form>
        )}
      </aside>
      <ConfirmDialog
        open={confirm}
        title="Delete task?"
        message="This task will be removed from all views."
        onConfirm={onDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
