/* Local development seed data. Wipes and recreates the demo users only. */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { Section } from '../models/Section.js';
import { Workspace } from '../models/Workspace.js';
import { createPersonalWorkspace } from '../services/workspace.service.js';
import { STATUSES, PRIORITIES } from '../config/constants.js';

const DEMO = [
  { name: 'Demo User', email: 'demo@example.com', password: 'Password123' },
  { name: 'Second User', email: 'second@example.com', password: 'Password123' },
];

const TITLES = [
  'Write quarterly report', 'Fix login redirect bug', 'Design onboarding flow', 'Review pull requests',
  'Prepare sprint demo', 'Update API documentation', 'Migrate database indexes', 'Customer feedback triage',
  'Refactor billing service', 'Plan team offsite', 'Audit access permissions', 'Optimize dashboard queries',
];
const TAGS = ['frontend', 'backend', 'urgent', 'docs', 'research', 'ops', 'design'];
const pick = (arr, i) => arr[i % arr.length];

await connectDb(env.mongoUri);

for (const demo of DEMO) {
  const existing = await User.findOne({ email: demo.email });
  if (existing) {
    const wsIds = (await Workspace.find({ owner: existing._id }).select('_id')).map((w) => w._id);
    await Task.deleteMany({ workspaceId: { $in: wsIds } });
    await Section.deleteMany({ workspaceId: { $in: wsIds } });
    await Workspace.deleteMany({ _id: { $in: wsIds } });
    await existing.deleteOne();
  }
  const user = await User.create(demo);
  const ws = await createPersonalWorkspace(user);
  const sections = await Section.find({ workspaceId: ws._id }).sort({ order: 1 });
  const now = Date.now();
  const count = demo.email.startsWith('demo') ? 60 : 5;

  for (let i = 0; i < count; i++) {
    const status = pick(STATUSES, i);
    const sla = [60, 240, 480, 1440, null][(i * 2) % 5];
    // Spread start times so the demo covers every SLA state: on track, at risk, breached, met and missed
    let startAt = new Date(now - ((i % 10) - 3) * 3600000 * 6);
    if (status === 'Done') startAt = new Date(now - 3 * 86400000);
    else if (sla && i % 6 === 1) startAt = new Date(now - sla * 0.9 * 60000);
    await Task.create({
      title: `${pick(TITLES, i)}${i >= TITLES.length ? ` #${Math.floor(i / TITLES.length) + 1}` : ''}`,
      description: `Seeded task ${i + 1}.\nThis description spans\nmultiple lines.`,
      status,
      priority: pick(PRIORITIES, i * 3),
      startAt,
      dueAt: i % 7 === 0 ? undefined : new Date(startAt.getTime() + ((i % 4) + 1) * 12 * 3600000),
      estimatedDurationMinutes: ((i % 8) + 1) * 30,
      timeSpentMinutes: (i % 5) * 20,
      slaDurationMinutes: sla ?? undefined,
      completedAt: status === 'Done' ? new Date(startAt.getTime() + (i % 2 ? 30 : 2000) * 60000) : undefined,
      tags: [pick(TAGS, i), pick(TAGS, i + 3)],
      createdBy: user._id,
      assignee: user._id,
      workspaceId: ws._id,
      sectionId: sections[STATUSES.indexOf(status)]._id,
      activity: [{ type: 'created', by: user._id }],
    });
  }
  console.log(`Seeded ${demo.email} / ${demo.password} with ${count} tasks`);
}

await mongoose.disconnect();
