import { Section } from '../models/Section.js';
import { Task } from '../models/Task.js';
import { Workspace } from '../models/Workspace.js';
import { ApiError, ok } from '../utils/http.js';
import { assertMember, defaultWorkspaceId, workspaceIdsFor } from '../services/workspace.service.js';
import { slaFilter, complianceRate } from '../services/sla.service.js';
import { env } from '../config/env.js';

/* ---------- Sections ---------- */
export async function listSections(req, res) {
  const workspaceId = req.query.workspaceId || (await defaultWorkspaceId(req.user._id));
  await assertMember(req.user._id, workspaceId);
  ok(res, await Section.find({ workspaceId }).sort({ order: 1, createdAt: 1 }).lean());
}

export async function createSection(req, res) {
  const workspaceId = req.body.workspaceId || (await defaultWorkspaceId(req.user._id));
  await assertMember(req.user._id, workspaceId, ['Owner', 'Admin']);
  const last = await Section.findOne({ workspaceId }).sort({ order: -1 }).lean();
  const section = await Section.create({ name: req.body.name, workspaceId, order: (last?.order ?? -1) + 1 });
  ok(res, section, {}, 201);
}

async function ownedSection(req) {
  const section = await Section.findById(req.params.id);
  if (!section) throw new ApiError(404, 'Section not found');
  await assertMember(req.user._id, section.workspaceId, ['Owner', 'Admin']);
  return section;
}

export async function updateSection(req, res) {
  const section = await ownedSection(req);
  if (req.body.name !== undefined) section.name = req.body.name;
  if (req.body.order !== undefined) section.order = req.body.order;
  await section.save();
  ok(res, section);
}

export async function deleteSection(req, res) {
  const section = await ownedSection(req);
  // Tasks in a deleted section become unsectioned rather than being deleted
  await Task.updateMany({ sectionId: section._id }, { $unset: { sectionId: 1 } });
  await section.deleteOne();
  ok(res, { id: section._id });
}

/* ---------- Workspaces / users ---------- */
export async function listWorkspaces(req, res) {
  const list = await Workspace.find({ 'members.user': req.user._id })
    .populate('members.user', 'name email')
    .lean();
  ok(res, list);
}

export async function currentUser(req, res) {
  ok(res, req.user);
}

/* ---------- Dashboard ---------- */
export async function stats(req, res) {
  const workspaceIds = await workspaceIdsFor(req.user._id);
  const base = { workspaceId: { $in: workspaceIds }, deletedAt: null };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const count = (extra) => Task.countDocuments({ ...base, ...extra });
  const [total, completed, overdue, dueToday, slaBreaches, byStatus] = await Promise.all([
    count({}),
    count({ status: 'Done' }),
    count({ dueAt: { $lt: now }, status: { $ne: 'Done' } }),
    count({ dueAt: { $gte: today, $lt: tomorrow } }),
    count(slaFilter('breached', now)),
    Task.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  ok(res, {
    total,
    completed,
    overdue,
    dueToday,
    slaBreaches,
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
  });
}

export async function slaSummary(req, res) {
  const workspaceIds = await workspaceIdsFor(req.user._id);
  const base = { workspaceId: { $in: workspaceIds }, deletedAt: null };
  const now = new Date();
  const to = req.query.to ? new Date(req.query.to) : now;
  const from = req.query.from ? new Date(req.query.from) : new Date(now.getTime() - 30 * 86400000);
  const period = { completedAt: { $gte: from, $lte: to } };
  const count = (state, extra = {}) => Task.countDocuments({ $and: [base, slaFilter(state, now), extra] });

  const [onTrack, atRisk, breached, met, missed, avg] = await Promise.all([
    count('on_track'),
    count('at_risk'),
    count('breached'),
    count('met', period),
    count('missed', period),
    Task.aggregate([
      { $match: { ...base, ...period } },
      { $project: { mins: { $divide: [{ $subtract: ['$completedAt', { $ifNull: ['$startAt', '$createdAt'] }] }, 60000] } } },
      { $group: { _id: null, avg: { $avg: '$mins' } } },
    ]),
  ]);
  ok(res, {
    onTrack,
    atRisk,
    breached,
    met,
    missed,
    compliance: complianceRate(met, missed),
    averageCompletionMinutes: avg[0] ? Math.round(avg[0].avg) : null,
    atRiskThreshold: env.slaAtRiskThreshold,
    period: { from, to },
  });
}
