import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const SLA_LABELS = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  breached: 'Breached',
  met: 'Met',
  missed: 'Missed',
  none: 'No SLA',
};
export const PAGE_SIZES = [10, 20, 50, 100];

export const fmtDateTime = (d) => (d ? dayjs(d).format('MMM D, YYYY h:mm A') : '—');
export const fmtDate = (d) => (d ? dayjs(d).format('MMM D, YYYY') : '—');
export const fromNow = (d) => (d ? dayjs(d).fromNow() : '');

export function fmtMinutes(m) {
  if (m == null || m === '') return '—';
  const n = Number(m);
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const r = n % 60;
  if (h < 24) return r ? `${h}h ${r}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

/** Local datetime-input value <-> ISO (UTC) string */
export const toInputDateTime = (d) => (d ? dayjs(d).format('YYYY-MM-DDTHH:mm') : '');
export const fromInputDateTime = (v) => (v ? new Date(v).toISOString() : null);

export const isOverdue = (t) => t.dueAt && t.status !== 'Done' && new Date(t.dueAt) < new Date();
