import { computeSla, complianceRate } from '../src/services/sla.service.js';

const now = new Date('2026-01-01T12:00:00Z');
const task = (deadlineOffsetMin, extra = {}) => ({
  slaDurationMinutes: 100,
  slaDeadline: new Date(now.getTime() + deadlineOffsetMin * 60000),
  ...extra,
});

describe('computeSla', () => {
  test('no SLA configured', () => {
    expect(computeSla({}, now).status).toBe('none');
  });
  test('on track when more than threshold remains', () => {
    expect(computeSla(task(21), now, 0.2).status).toBe('on_track');
  });
  test('at risk exactly at threshold boundary', () => {
    expect(computeSla(task(20), now, 0.2).status).toBe('at_risk');
  });
  test('at risk at the deadline itself', () => {
    expect(computeSla(task(0), now, 0.2).status).toBe('at_risk');
  });
  test('breached one minute after deadline, reports overdue duration', () => {
    const r = computeSla(task(-1), now, 0.2);
    expect(r.status).toBe('breached');
    expect(r.overdueMinutes).toBe(1);
  });
  test('met when completed exactly at deadline', () => {
    expect(computeSla(task(0, { completedAt: now }), now).status).toBe('met');
  });
  test('missed when completed after deadline', () => {
    const t = task(-30, { completedAt: now });
    const r = computeSla(t, now);
    expect(r.status).toBe('missed');
    expect(r.overdueMinutes).toBe(30);
  });
  test('threshold is configurable', () => {
    expect(computeSla(task(40), now, 0.5).status).toBe('at_risk');
    expect(computeSla(task(40), now, 0.2).status).toBe('on_track');
  });
});

describe('complianceRate', () => {
  test('returns null when there are no eligible tasks', () => {
    expect(complianceRate(0, 0)).toBeNull();
  });
  test('computes percentage', () => {
    expect(complianceRate(3, 1)).toBe(75);
  });
});
