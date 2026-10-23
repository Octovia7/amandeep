import { AlertTriangle, CheckCircle2, Clock, XCircle, MinusCircle, ArrowUp, ArrowDown, ChevronsUp, Minus } from 'lucide-react';
import { SLA_LABELS, fmtMinutes } from '../../utils/format';

const STATUS_STYLES = {
  Backlog: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'To Do': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  'In Progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'In Review': 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  Done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export function StatusBadge({ status }) {
  return <span className={`chip ${STATUS_STYLES[status] || STATUS_STYLES.Backlog}`}>{status}</span>;
}

const PRIORITY = {
  Low: { icon: ArrowDown, cls: 'text-slate-500' },
  Medium: { icon: Minus, cls: 'text-sky-600 dark:text-sky-400' },
  High: { icon: ArrowUp, cls: 'text-orange-600 dark:text-orange-400' },
  Urgent: { icon: ChevronsUp, cls: 'text-red-600 dark:text-red-400' },
};

export function PriorityBadge({ priority, compact }) {
  const p = PRIORITY[priority] || PRIORITY.Medium;
  const Icon = p.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${p.cls}`} title={`Priority: ${priority}`}>
      <Icon size={14} aria-hidden />
      {!compact && priority}
    </span>
  );
}

const SLA = {
  on_track: { icon: Clock, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800' },
  at_risk: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800' },
  breached: { icon: XCircle, cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800' },
  met: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800' },
  missed: { icon: XCircle, cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800' },
  none: { icon: MinusCircle, cls: 'bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700' },
};

/** SLA indicator shared by every view. Shows remaining time or overdue duration. */
export function SlaBadge({ task, showTime = true }) {
  const status = task.slaStatus || 'none';
  const s = SLA[status];
  const Icon = s.icon;
  let detail = '';
  if (showTime && task.sla) {
    if ((status === 'on_track' || status === 'at_risk') && task.sla.remainingMinutes != null) detail = `${fmtMinutes(task.sla.remainingMinutes)} left`;
    if ((status === 'breached' || status === 'missed') && task.sla.overdueMinutes) detail = `+${fmtMinutes(task.sla.overdueMinutes)}`;
  }
  return (
    <span className={`chip ring-1 ring-inset ${s.cls}`} title={task.sla?.deadline ? `SLA deadline: ${new Date(task.sla.deadline).toLocaleString()}` : 'No SLA'}>
      <Icon size={12} aria-hidden />
      {SLA_LABELS[status]}
      {detail && <span className="font-normal opacity-80">· {detail}</span>}
    </span>
  );
}

export function Tag({ children }) {
  return <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">#{children}</span>;
}
