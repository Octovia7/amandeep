import mongoose from 'mongoose';
import { STATUSES, PRIORITIES, PRIORITY_RANK, STATUS_RANK } from '../config/constants.js';

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    field: String,
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const nonNegative = { validator: (v) => v == null || v >= 0, message: '{PATH} must be >= 0' };

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 10000 },
    status: { type: String, enum: STATUSES, default: 'To Do' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    priorityRank: Number,
    statusRank: Number,
    startAt: Date,
    dueAt: Date,
    estimatedDurationMinutes: { type: Number, validate: nonNegative },
    actualDurationMinutes: { type: Number, validate: nonNegative },
    timeSpentMinutes: { type: Number, default: 0, validate: nonNegative },
    slaDurationMinutes: { type: Number, validate: nonNegative },
    // Denormalised (startAt || createdAt) + slaDurationMinutes so SLA filters run inside MongoDB
    slaDeadline: Date,
    completedAt: Date,
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    activity: { type: [activitySchema], select: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.pre('validate', function derive() {
  if (this.startAt && this.dueAt && this.dueAt < this.startAt) {
    this.invalidate('dueAt', 'dueAt must be after startAt');
  }
  this.priorityRank = PRIORITY_RANK[this.priority];
  this.statusRank = STATUS_RANK[this.status];
  if (this.status === 'Done' && !this.completedAt) this.completedAt = new Date();
  if (this.status !== 'Done') this.completedAt = undefined;
  if (this.slaDurationMinutes) {
    const base = this.startAt || this.createdAt || new Date();
    this.slaDeadline = new Date(new Date(base).getTime() + this.slaDurationMinutes * 60000);
  } else {
    this.slaDeadline = undefined;
  }
  if (this.completedAt && this.actualDurationMinutes == null && this.startAt) {
    this.actualDurationMinutes = Math.max(0, Math.round((this.completedAt - this.startAt) / 60000));
  }
});

taskSchema.index({ workspaceId: 1, deletedAt: 1, status: 1 });
taskSchema.index({ workspaceId: 1, deletedAt: 1, dueAt: 1 });
taskSchema.index({ workspaceId: 1, deletedAt: 1, createdAt: -1 });
taskSchema.index({ workspaceId: 1, sectionId: 1 });
taskSchema.index({ slaDeadline: 1, completedAt: 1 });
taskSchema.index({ tags: 1 });

export const Task = mongoose.model('Task', taskSchema);
