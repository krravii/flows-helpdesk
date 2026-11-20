import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true, trim: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null, index: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    team: { type: String, default: '' },
    priority: {
      type: String,
      enum: ['Urgent', 'High', 'Normal', 'Low'],
      default: 'Normal',
      index: true
    },
    status: {
      type: String,
      enum: [
        'New',
        'Open',
        'In Progress',
        'Waiting for Customer',
        'Waiting for Internal Team',
        'Resolved',
        'Closed'
      ],
      default: 'New',
      index: true
    },
    category: { type: String, default: 'General Support', index: true },
    source: {
      type: String,
      enum: ['Email', 'Web Portal', 'Manual', 'System Integration'],
      default: 'Web Portal'
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    emailThreadRootId: { type: String, index: true },
    sla: {
      policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPolicy', default: null },
      status: {
        type: String,
        enum: ['On Track', 'Warning', 'Breached', 'Paused', 'Met'],
        default: 'On Track',
        index: true
      },
      firstResponseDueAt: { type: Date, default: null },
      resolutionDueAt: { type: Date, default: null },
      firstRespondedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

ticketSchema.index({ orgId: 1, status: 1, updatedAt: -1 });
ticketSchema.index({ assigneeId: 1, status: 1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);
