import { Workspace } from '../models/Workspace.js';
import { Section } from '../models/Section.js';
import { STATUSES } from '../config/constants.js';
import { ApiError } from '../utils/http.js';

export async function createPersonalWorkspace(user) {
  const ws = await Workspace.create({
    name: `${user.name}'s Workspace`,
    owner: user._id,
    members: [{ user: user._id, role: 'Owner' }],
  });
  await Section.insertMany(STATUSES.map((name, order) => ({ name, order, workspaceId: ws._id })));
  return ws;
}

export async function workspaceIdsFor(userId) {
  const list = await Workspace.find({ 'members.user': userId }).select('_id').lean();
  return list.map((w) => w._id);
}

/** Throws 404 (not 403) so that resource existence isn't leaked across tenants. */
export async function assertMember(userId, workspaceId, roles) {
  const ws = await Workspace.findOne({ _id: workspaceId, 'members.user': userId }).lean();
  if (!ws) throw new ApiError(404, 'Workspace not found');
  const member = ws.members.find((m) => String(m.user) === String(userId));
  if (roles && !roles.includes(member.role)) throw new ApiError(403, 'Insufficient workspace permissions');
  return ws;
}

export async function defaultWorkspaceId(userId) {
  const ws = await Workspace.findOne({ 'members.user': userId }).sort({ createdAt: 1 }).select('_id').lean();
  if (!ws) throw new ApiError(404, 'No workspace found');
  return ws._id;
}
