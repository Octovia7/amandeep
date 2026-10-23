import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sectionSchema.index({ workspaceId: 1, order: 1 });

export const Section = mongoose.model('Section', sectionSchema);
