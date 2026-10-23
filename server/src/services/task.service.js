import { Task } from '../models/Task.js';
import { Section } from '../models/Section.js';
import { ApiError } from '../utils/http.js';
import { computeSla } from './sla.service.js';
import { workspaceIdsFor, defaultWorkspaceId, assertMember } from './workspace.service.js';
import { buildTaskQuery, parsePagination, paginationMeta } from './taskQuery.service.js';

const EDITABLE = [
  'title',
  'description',
  'status',
  'priority',
  'startAt',
  'dueAt',
  'estimatedDurationMinutes',
  'actualDurationMinutes',
  'timeSpentMinutes',
  'slaDurationMinutes',
  'assignee',
  'sectionId',
  'tags',
];
const TRACKED = ['status', 'priority', 'dueAt', 'assignee', 'sectionId', 'title', 'slaDurationMinutes'];
const POPULATE = [
  { path: 'assignee', select: 'name email' },
  { path: 'createdBy', select: 'name email' },
];

export function serialize(task, now = new Date()) {
  const obj = typeof task.toObject === 'function' ? task.toObject() : { ...task };
  delete obj.__v;
  delete obj.priorityRank;
  delete obj.statusRank;
  const sla = computeSla(obj, now);
  return { ...obj, id: obj._id, slaStatus: sla.status, sla };
}

async function findOwnedTask(userId, id, withActivity = false) {
  const workspaceIds = await workspaceIdsFor(userId);
  const q = Task.findOne({ _id: id, workspaceId: { $in: workspaceIds }, deletedAt: null }).populate(POPULATE);
  if (withActivity) q.select('+activity').populate({ path: 'activity.by', select: 'name' });
  const task = await q;
  if (!task) throw new ApiError(404, 'Task not found');
  return task;
}

async function assertSectionInWorkspace(sectionId, workspaceId) {
  if (!sectionId) return;
  const ok = await Section.exists({ _id: sectionId, workspaceId });
  if (!ok) throw new ApiError(400, 'Section does not belong to this workspace');
}

const sameValue = (a, b) => String(a?._id ?? a ?? '') === String(b?._id ?? b ?? '');

function applyChanges(task, body, userId) {
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const before = task[key];
    task[key] = body[key] === '' ? undefined : body[key];
    if (TRACKED.includes(key) && !sameValue(before, task[key])) {
      task.activity.push({ type: 'updated', field: key, from: before?._id ?? before, to: body[key], by: userId });
    }
  }
}

export async function listTasks(user, query) {
  const workspaceIds = await workspaceIdsFor(user._id);
  const { filter, sort } = buildTaskQuery(query, { userId: user._id, workspaceIds });
  const { page, limit, skip } = parsePagination(query);
  const [items, totalItems] = await Promise.all([
    Task.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE).lean(),
    Task.countDocuments(filter),
  ]);
  const now = new Date();
  return { data: items.map((t) => serialize(t, now)), pagination: paginationMeta(page, limit, totalItems) };
}

export async function getTask(user, id) {
  return serialize(await findOwnedTask(user._id, id, true));
}

export async function createTask(user, body) {
  const workspaceId = body.workspaceId || (await defaultWorkspaceId(user._id));
  await assertMember(user._id, workspaceId);
  await assertSectionInWorkspace(body.sectionId, workspaceId);
  if (body.assignee) await assertMember(body.assignee, workspaceId).catch(() => {
    throw new ApiError(400, 'Assignee is not a member of this workspace');
  });
  const task = new Task({ workspaceId, createdBy: user._id, activity: [{ type: 'created', by: user._id }] });
  applyChanges(task, body, user._id);
  task.activity = [{ type: 'created', by: user._id }];
  await task.save();
  await task.populate(POPULATE);
  return serialize(task);
}

export async function updateTask(user, id, body) {
  const task = await findOwnedTask(user._id, id, true);
  if (body.sectionId) await assertSectionInWorkspace(body.sectionId, task.workspaceId);
  if (body.assignee) await assertMember(body.assignee, task.workspaceId).catch(() => {
    throw new ApiError(400, 'Assignee is not a member of this workspace');
  });
  applyChanges(task, body, user._id);
  await task.save();
  await task.populate(POPULATE);
  return serialize(task);
}

export async function deleteTask(user, id) {
  const task = await findOwnedTask(user._id, id);
  task.deletedAt = new Date();
  await task.save();
}

export async function bulkUpdate(user, { ids, action, changes = {} }) {
  const workspaceIds = await workspaceIdsFor(user._id);
  const tasks = await Task.find({ _id: { $in: ids }, workspaceId: { $in: workspaceIds }, deletedAt: null }).select(
    '+activity'
  );
  for (const task of tasks) {
    if (action === 'delete') task.deletedAt = new Date();
    else if (action === 'complete') applyChanges(task, { status: 'Done' }, user._id);
    else applyChanges(task, changes, user._id);
    await task.save();
  }
  return { matched: tasks.length };
}
