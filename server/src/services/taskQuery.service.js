import mongoose from 'mongoose';
import { slaFilter } from './sla.service.js';

const csv = (v) =>
  v == null || v === ''
    ? []
    : (Array.isArray(v) ? v : String(v).split(','))
        .map((s) => s.trim())
        .filter(Boolean);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toId = (v) => new mongoose.Types.ObjectId(String(v));

function range(min, max, cast) {
  const r = {};
  if (min !== undefined && min !== '') r.$gte = cast(min);
  if (max !== undefined && max !== '') r.$lte = cast(max);
  return Object.keys(r).length ? r : null;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/** Converts a named due-date preset into a Mongo condition fragment. */
function dueRangePreset(preset, now) {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { dueAt: { $gte: today, $lt: addDays(today, 1) } };
    case 'tomorrow':
      return { dueAt: { $gte: addDays(today, 1), $lt: addDays(today, 2) } };
    case 'week': {
      const dow = (today.getDay() + 6) % 7; // Monday-based week
      const monday = addDays(today, -dow);
      return { dueAt: { $gte: monday, $lt: addDays(monday, 7) } };
    }
    case 'upcoming':
      return { dueAt: { $gte: addDays(today, 1) }, status: { $ne: 'Done' } };
    case 'overdue':
      return { dueAt: { $lt: now }, status: { $ne: 'Done' } };
    case 'none':
      return { dueAt: null };
    default:
      return null;
  }
}

const SORT_FIELDS = {
  title: 'title',
  priority: 'priorityRank',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  dueAt: 'dueAt',
  startAt: 'startAt',
  duration: 'estimatedDurationMinutes',
  estimatedDurationMinutes: 'estimatedDurationMinutes',
  actualDurationMinutes: 'actualDurationMinutes',
  status: 'statusRank',
  sla: 'slaDeadline',
};

/**
 * Build a MongoDB filter + sort from validated query params.
 * `workspaceIds` comes from the authenticated user's memberships, never from the client.
 */
export function buildTaskQuery(q, { userId, workspaceIds, now = new Date() }) {
  const and = [{ deletedAt: null }];

  const requestedWs = csv(q.workspaceId).filter((id) => workspaceIds.some((w) => String(w) === id));
  and.push({ workspaceId: { $in: requestedWs.length ? requestedWs.map(toId) : workspaceIds } });

  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }, { tags: rx }] });
  }
  if (q.title) and.push({ title: new RegExp(escapeRegex(q.title), 'i') });
  if (q.description) and.push({ description: new RegExp(escapeRegex(q.description), 'i') });

  const statuses = csv(q.status);
  if (statuses.length) and.push({ status: { $in: statuses } });
  const priorities = csv(q.priority);
  if (priorities.length) and.push({ priority: { $in: priorities } });
  const tags = csv(q.tags).map((t) => t.toLowerCase());
  if (tags.length) and.push({ tags: { $all: tags } });

  const assignees = csv(q.assignee);
  if (assignees.length) and.push({ assignee: { $in: assignees.map((a) => (a === 'me' ? userId : toId(a))) } });
  const creators = csv(q.createdBy);
  if (creators.length) and.push({ createdBy: { $in: creators.map((a) => (a === 'me' ? userId : toId(a))) } });
  const sections = csv(q.sectionId);
  if (sections.length) and.push({ sectionId: { $in: sections.map((s) => (s === 'none' ? null : toId(s))) } });

  const date = (v) => new Date(v);
  for (const [field, key] of [
    ['createdAt', 'created'],
    ['updatedAt', 'updated'],
    ['startAt', 'start'],
    ['dueAt', 'due'],
    ['completedAt', 'completed'],
  ]) {
    const r = range(q[`${key}From`], q[`${key}To`], date);
    if (r) and.push({ [field]: r });
  }

  const num = Number;
  for (const [field, key] of [
    ['estimatedDurationMinutes', 'est'],
    ['actualDurationMinutes', 'actual'],
    ['timeSpentMinutes', 'spent'],
    ['slaDurationMinutes', 'slaDur'],
  ]) {
    const r = range(q[`${key}Min`], q[`${key}Max`], num);
    if (r) and.push({ [field]: r });
  }

  if (q.dueRange) {
    const preset = dueRangePreset(q.dueRange, now);
    if (preset) and.push(preset);
  }

  // Sidebar "views" map onto the same filter primitives
  switch (q.view) {
    case 'my':
      and.push({ $or: [{ assignee: userId }, { assignee: null, createdBy: userId }] });
      break;
    case 'today':
    case 'upcoming':
    case 'overdue':
      and.push(dueRangePreset(q.view, now));
      break;
    case 'completed':
      and.push({ status: 'Done' });
      break;
    default:
  }

  const slaStates = csv(q.sla);
  if (slaStates.length) {
    const ors = slaStates.map((s) => slaFilter(s, now)).filter(Boolean);
    if (ors.length) and.push({ $or: ors });
  }

  const sortField = SORT_FIELDS[q.sortBy] || 'createdAt';
  const dir = q.order === 'asc' ? 1 : -1;
  const sort = { [sortField]: dir, _id: dir };

  return { filter: { $and: and }, sort };
}

export function parsePagination(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(page, limit, totalItems) {
  const totalPages = Math.ceil(totalItems / limit);
  return { page, limit, totalItems, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
}
