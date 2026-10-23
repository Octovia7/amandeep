import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { api, errorMessage } from '../services/api';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { fmtMinutes, STATUSES } from '../utils/format';

function Stat({ label, value, to, tone = 'text-slate-900 dark:text-slate-100' }) {
  const body = (
    <div className="card p-4 transition hover:border-indigo-300">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

const PERIODS = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' };

export default function DashboardPage() {
  const user = useSelector((s) => s.auth.user);
  const version = useSelector((s) => s.tasks.version);
  const [stats, setStats] = useState(null);
  const [sla, setSla] = useState(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const from = new Date(Date.now() - days * 86400000).toISOString();
      const [s, l] = await Promise.all([api.get('/dashboard/stats'), api.get('/dashboard/sla', { params: { from } })]);
      setStats(s.data.data);
      setSla(l.data.data);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, version]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">Here’s what’s happening across your tasks.</p>
      </div>

      {!stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Total tasks" value={stats.total} to="/tasks/all" />
          <Stat label="Completed" value={stats.completed} to="/tasks/completed" tone="text-emerald-600" />
          <Stat label="Due today" value={stats.dueToday} to="/tasks/today" tone="text-sky-600" />
          <Stat label="Overdue" value={stats.overdue} to="/tasks/overdue" tone="text-red-600" />
          <Stat label="SLA breaches" value={stats.slaBreaches} to="/tasks/all?sla=breached" tone="text-red-600" />
        </div>
      )}

      <section className="card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">SLA summary</h2>
          <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Reporting period">
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {!sla ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="On track" value={sla.onTrack} to="/tasks/all?sla=on_track" tone="text-emerald-600" />
            <Stat label="At risk" value={sla.atRisk} to="/tasks/all?sla=at_risk" tone="text-amber-600" />
            <Stat label="Breached (active)" value={sla.breached} to="/tasks/all?sla=breached" tone="text-red-600" />
            <Stat label="Compliance" value={sla.compliance == null ? 'N/A' : `${sla.compliance}%`} />
            <Stat label="Avg completion" value={sla.averageCompletionMinutes == null ? 'N/A' : fmtMinutes(sla.averageCompletionMinutes)} />
          </div>
        )}
        {sla && (
          <p className="mt-3 text-xs text-slate-500">
            Compliance = tasks completed within SLA ÷ all completed tasks with an SLA in the period ({sla.met} met, {sla.missed} missed). A task is “at
            risk” when ≤ {Math.round(sla.atRiskThreshold * 100)}% of its SLA window remains.
          </p>
        )}
      </section>

      {stats && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">By status</h2>
          <div className="space-y-2">
            {STATUSES.map((s) => {
              const n = stats.byStatus[s] || 0;
              const pct = stats.total ? (n / stats.total) * 100 : 0;
              return (
                <div key={s} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm">
                  <span>{s}</span>
                  <div className="h-2 rounded bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-right tabular-nums text-slate-500">{n}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
