import { env } from '../config/env.js';

/**
 * SLA states:
 *  none      - task has no SLA
 *  on_track  - active, more than `threshold` of the SLA window remaining
 *  at_risk   - active, at most `threshold` of the SLA window remaining
 *  breached  - active and past the SLA deadline
 *  met       - completed on or before the deadline
 *  missed    - completed after the deadline
 */
export function computeSla(task, now = new Date(), threshold = env.slaAtRiskThreshold) {
  const dur = task.slaDurationMinutes;
  if (!dur || !task.slaDeadline) return { status: 'none', deadline: null, remainingMinutes: null, overdueMinutes: 0 };
  const deadline = new Date(task.slaDeadline);

  if (task.completedAt) {
    const late = new Date(task.completedAt) - deadline;
    return {
      status: late <= 0 ? 'met' : 'missed',
      deadline,
      remainingMinutes: null,
      overdueMinutes: late <= 0 ? 0 : Math.round(late / 60000),
    };
  }
  const remainingMs = deadline - now;
  if (remainingMs < 0) {
    return { status: 'breached', deadline, remainingMinutes: 0, overdueMinutes: Math.round(-remainingMs / 60000) };
  }
  const status = remainingMs <= dur * 60000 * threshold ? 'at_risk' : 'on_track';
  return { status, deadline, remainingMinutes: Math.round(remainingMs / 60000), overdueMinutes: 0 };
}

/** MongoDB filter that matches tasks in the given SLA state; mirrors computeSla. */
export function slaFilter(state, now = new Date(), threshold = env.slaAtRiskThreshold) {
  const hasSla = { slaDeadline: { $ne: null } };
  const riskExpr = {
    $lte: [{ $subtract: ['$slaDeadline', now] }, { $multiply: ['$slaDurationMinutes', 60000, threshold] }],
  };
  switch (state) {
    case 'none':
      return { slaDeadline: null };
    case 'breached':
      return { completedAt: null, slaDeadline: { $ne: null, $lt: now } };
    case 'at_risk':
      return { completedAt: null, slaDeadline: { $gte: now }, $expr: riskExpr };
    case 'on_track':
      return { completedAt: null, slaDeadline: { $gte: now }, $expr: { $not: [riskExpr] } };
    case 'met':
      return { ...hasSla, completedAt: { $ne: null }, $expr: { $lte: ['$completedAt', '$slaDeadline'] } };
    case 'missed':
      return { ...hasSla, completedAt: { $ne: null }, $expr: { $gt: ['$completedAt', '$slaDeadline'] } };
    default:
      return null;
  }
}

/** Percentage of eligible completed tasks that met their SLA; null when there are none. */
export function complianceRate(met, missed) {
  const total = met + missed;
  return total === 0 ? null : Math.round((met / total) * 1000) / 10;
}
