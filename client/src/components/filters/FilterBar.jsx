import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Filter, Search, X, ArrowUpDown, List, Rows3, KanbanSquare } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { listParam } from '../../hooks/useTaskFilters';
import { STATUSES, PRIORITIES, SLA_LABELS } from '../../utils/format';

const SORTS = [
  ['createdAt', 'Created date'],
  ['dueAt', 'Due date'],
  ['title', 'Task name'],
  ['priority', 'Priority'],
  ['status', 'Status'],
  ['duration', 'Est. duration'],
  ['sla', 'SLA deadline'],
];

const DATE_FIELDS = [
  ['created', 'Created'],
  ['updated', 'Updated'],
  ['start', 'Start'],
  ['due', 'Due'],
  ['completed', 'Completed'],
];
const DURATION_FIELDS = [
  ['est', 'Estimated (min)'],
  ['actual', 'Actual (min)'],
  ['spent', 'Time spent (min)'],
  ['slaDur', 'SLA duration (min)'],
];
const DUE_PRESETS = { today: 'Due today', tomorrow: 'Due tomorrow', week: 'Due this week', overdue: 'Overdue', none: 'No due date' };

function MultiToggle({ label, options, value, onChange, render = (o) => o }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              type="button"
              key={o}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              className={`chip border ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-700'}`}
            >
              {render(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FilterPanel({ params, setFilter, onClose }) {
  const sections = useSelector((s) => s.sections.items);
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filters"
      className="card absolute right-0 top-full z-30 mt-1 max-h-[75vh] w-[min(92vw,26rem)] space-y-4 overflow-y-auto p-4 shadow-xl"
    >
      <MultiToggle label="Status" options={STATUSES} value={listParam(params.status)} onChange={(v) => setFilter({ status: v })} />
      <MultiToggle label="Priority" options={PRIORITIES} value={listParam(params.priority)} onChange={(v) => setFilter({ priority: v })} />
      <MultiToggle
        label="SLA"
        options={Object.keys(SLA_LABELS)}
        value={listParam(params.sla)}
        onChange={(v) => setFilter({ sla: v })}
        render={(o) => SLA_LABELS[o]}
      />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Due</span>
          <select className="input" value={params.dueRange || ''} onChange={(e) => setFilter({ dueRange: e.target.value })}>
            <option value="">Any time</option>
            {Object.entries(DUE_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Section</span>
          <select className="input" value={params.sectionId || ''} onChange={(e) => setFilter({ sectionId: e.target.value })}>
            <option value="">Any section</option>
            <option value="none">No section</option>
            {sections.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Assignee</span>
          <select className="input" value={params.assignee || ''} onChange={(e) => setFilter({ assignee: e.target.value })}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
          </select>
        </label>
        <label>
          <span className="label">Creator</span>
          <select className="input" value={params.createdBy || ''} onChange={(e) => setFilter({ createdBy: e.target.value })}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Tags (comma separated, all must match)</span>
        <input className="input" defaultValue={params.tags || ''} onBlur={(e) => setFilter({ tags: e.target.value.replace(/\s/g, '') })} />
      </label>
      <label className="block">
        <span className="label">Description contains</span>
        <input className="input" defaultValue={params.description || ''} onBlur={(e) => setFilter({ description: e.target.value })} />
      </label>

      <fieldset>
        <legend className="label">Date ranges</legend>
        <div className="space-y-1.5">
          {DATE_FIELDS.map(([k, label]) => (
            <div key={k} className="grid grid-cols-[5rem_1fr_1fr] items-center gap-1.5 text-xs">
              <span>{label}</span>
              <input
                type="date"
                aria-label={`${label} from`}
                className="input py-1 text-xs"
                value={params[`${k}From`] ? new Date(params[`${k}From`]).toLocaleDateString('en-CA') : ''}
                onChange={(e) => setFilter({ [`${k}From`]: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : '' })}
              />
              <input
                type="date"
                aria-label={`${label} to`}
                className="input py-1 text-xs"
                value={params[`${k}To`] ? new Date(params[`${k}To`]).toLocaleDateString('en-CA') : ''}
                onChange={(e) => setFilter({ [`${k}To`]: e.target.value ? new Date(`${e.target.value}T23:59:59.999`).toISOString() : '' })}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Durations (min / max)</legend>
        <div className="space-y-1.5">
          {DURATION_FIELDS.map(([k, label]) => (
            <div key={k} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-1.5 text-xs">
              <span>{label}</span>
              {['Min', 'Max'].map((m) => (
                <input
                  key={m}
                  type="number"
                  min="0"
                  placeholder={m}
                  aria-label={`${label} ${m}`}
                  className="input py-1 text-xs"
                  defaultValue={params[`${k}${m}`] || ''}
                  onBlur={(e) => setFilter({ [`${k}${m}`]: e.target.value })}
                />
              ))}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

const CHIP_LABELS = {
  status: 'Status',
  priority: 'Priority',
  sla: 'SLA',
  dueRange: 'Due',
  tags: 'Tags',
  assignee: 'Assignee',
  createdBy: 'Creator',
  sectionId: 'Section',
  title: 'Title',
  description: 'Description',
};
const NON_FILTER_KEYS = ['mode', 'page', 'limit', 'sortBy', 'order', 'search'];

function chipText(key, value, sections) {
  if (key === 'sla') return value.split(',').map((v) => SLA_LABELS[v]).join(', ');
  if (key === 'dueRange') return DUE_PRESETS[value] || value;
  if (key === 'sectionId') return value === 'none' ? 'No section' : sections.find((s) => s._id === value)?.name || 'Section';
  const m = key.match(/^(created|updated|start|due|completed)(From|To)$/);
  if (m) return `${m[1]} ${m[2] === 'From' ? '≥' : '≤'} ${new Date(value).toLocaleDateString()}`;
  const d = key.match(/^(est|actual|spent|slaDur)(Min|Max)$/);
  if (d) return `${{ est: 'Estimated', actual: 'Actual', spent: 'Spent', slaDur: 'SLA dur.' }[d[1]]} ${d[2] === 'Min' ? '≥' : '≤'} ${value}m`;
  return `${CHIP_LABELS[key] || key}: ${value}`;
}

export default function FilterBar({ params, setFilter, clearFilters, mode, showModes = true }) {
  const sections = useSelector((s) => s.sections.items);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(params.search || '');
  const debounced = useDebounce(search);

  useEffect(() => {
    if ((params.search || '') !== debounced) setFilter({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep the box in sync when search changes from outside (top-bar search, back/forward)
  useEffect(() => {
    if ((params.search || '') !== debounced) setSearch(params.search || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.search]);

  const active = Object.entries(params).filter(([k]) => !NON_FILTER_KEYS.includes(k));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            className="input pl-8"
            placeholder="Search title, description, tags…"
            aria-label="Search tasks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <button className="btn-outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Filter size={15} /> Filters {active.length > 0 && <span className="chip bg-indigo-600 text-white">{active.length}</span>}
          </button>
          {open && <FilterPanel params={params} setFilter={setFilter} onClose={() => setOpen(false)} />}
        </div>
        <div className="flex items-center gap-1">
          <label className="sr-only" htmlFor="sortBy">
            Sort by
          </label>
          <select id="sortBy" className="input w-auto" value={params.sortBy || 'createdAt'} onChange={(e) => setFilter({ sortBy: e.target.value })}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button
            className="btn-outline px-2"
            title={params.order === 'asc' ? 'Ascending' : 'Descending'}
            aria-label={`Sort order: ${params.order === 'asc' ? 'ascending' : 'descending'}`}
            onClick={() => setFilter({ order: params.order === 'asc' ? 'desc' : 'asc' })}
          >
            <ArrowUpDown size={15} />
            <span className="text-xs">{params.order === 'asc' ? 'Asc' : 'Desc'}</span>
          </button>
        </div>
        {showModes && (
          <div role="tablist" aria-label="View" className="flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700">
            {[
              ['list', List, 'List'],
              ['section', Rows3, 'Section'],
              ['kanban', KanbanSquare, 'Kanban'],
            ].map(([m, Icon, label]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setFilter({ mode: m === 'list' ? '' : m }, { resetPage: false })}
                className={`btn px-2 py-1 ${mode === m ? 'bg-slate-200 dark:bg-slate-700' : 'text-slate-500'}`}
              >
                <Icon size={15} /> <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map(([k, v]) => (
            <span key={k} className="chip bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {chipText(k, v, sections)}
              <button aria-label={`Remove ${k} filter`} onClick={() => setFilter({ [k]: '' })} className="hover:text-indigo-900">
                <X size={12} />
              </button>
            </span>
          ))}
          <button className="text-xs text-slate-500 underline hover:text-slate-700" onClick={() => { setSearch(''); clearFilters(); }}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
