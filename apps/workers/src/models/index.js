import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 }
});
export const Counter = mongoose.model('Counter', counterSchema);

export async function getNextTicketNumber(prefix = 'FLW-', session = null) {
  const doc = await Counter.findByIdAndUpdate(
    'ticket_number',
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `${prefix}${doc.seq}`;
}

const organisationSchema = new mongoose.Schema({
  name: String,
  code: String,
  primaryDomain: String,
  additionalDomains: [String],
  registeredEmails: [String],
  status: String
});
export const Organisation = mongoose.model('Organisation', organisationSchema);

const userSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  userType: String,
  roleId: mongoose.Schema.Types.ObjectId,
  orgId: mongoose.Schema.Types.ObjectId,
  status: String
});
export const User = mongoose.model('User', userSchema);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true },
    subject: String,
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    requesterName: String,
    requesterEmail: String,
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    priority: { type: String, default: 'Normal' },
    status: { type: String, default: 'New' },
    category: { type: String, default: 'Email' },
    source: { type: String, default: 'Email' },
    tags: [String],
    emailThreadRootId: String,
    sla: {
      policyId: mongoose.Schema.Types.ObjectId,
      status: { type: String, default: 'On Track' },
      firstResponseDueAt: Date,
      resolutionDueAt: Date,
      firstRespondedAt: Date,
      resolvedAt: Date
    }
  },
  { timestamps: true }
);
export const Ticket = mongoose.model('Ticket', ticketSchema);

const ticketMessageSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    type: String,
    authorId: mongoose.Schema.Types.ObjectId,
    authorName: String,
    authorEmail: String,
    bodyText: String,
    bodyHtml: String,
    attachments: [{ fileName: String, mimeType: String, sizeBytes: Number, s3Key: String }],
    emailMeta: {
      from: String,
      to: String,
      cc: String,
      subject: String,
      messageId: String,
      inReplyTo: String,
      references: [String]
    }
  },
  { timestamps: true }
);
export const TicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);

const emailRoutingRuleSchema = new mongoose.Schema({
  name: String,
  matchType: String,
  matchValue: String,
  orgId: mongoose.Schema.Types.ObjectId,
  assignCategory: String,
  assignPriority: String,
  priority: Number,
  status: String
});
export const EmailRoutingRule = mongoose.model('EmailRoutingRule', emailRoutingRuleSchema);

const emailLogSchema = new mongoose.Schema(
  {
    sender: String,
    subject: String,
    result: String,
    ticketNumber: String,
    orgName: String,
    error: String
  },
  { timestamps: true }
);
export const EmailLog = mongoose.model('EmailLog', emailLogSchema);

const systemSettingSchema = new mongoose.Schema({
  _id: String,
  imap: Object,
  smtp: Object
});
export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

const slaPolicySchema = new mongoose.Schema({
  priority: String,
  firstResponseMins: Number,
  resolutionHours: Number,
  warningThresholdPct: Number,
  enabled: Boolean
});
export const SlaPolicy = mongoose.model('SlaPolicy', slaPolicySchema);

const auditLogSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    action: String,
    module: String,
    target: String,
    ipAddress: String,
    details: String
  },
  { timestamps: true }
);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

const notificationSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    type: String,
    title: String,
    message: String,
    ticketNumber: String,
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);
export const Notification = mongoose.model('Notification', notificationSchema);
