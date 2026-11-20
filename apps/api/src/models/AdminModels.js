import mongoose from 'mongoose';

const slaPolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    priority: { type: String, enum: ['Urgent', 'High', 'Normal', 'Low'], required: true, unique: true },
    firstResponseMins: { type: Number, required: true },
    resolutionHours: { type: Number, required: true },
    businessHours: { type: String, default: '24x7 Follow-the-Sun' },
    calendar: { type: String, default: 'Global 24/7' },
    warningThresholdPct: { type: Number, default: 80 },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const emailTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    htmlBody: { type: String, required: true },
    textBody: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' }
  },
  { timestamps: true }
);

const emailRoutingRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    matchType: { type: String, enum: ['Organisation Domain', 'Email Address', 'Subject Keyword', 'Fallback'], required: true },
    matchValue: { type: String, required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null },
    assignCategory: { type: String, default: '' },
    assignPriority: { type: String, default: '' },
    priority: { type: Number, default: 10 },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' }
  },
  { timestamps: true }
);

const systemSettingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    imap: {
      host: { type: String, default: 'imap.sinchflows.io' },
      port: { type: Number, default: 993 },
      email: { type: String, default: 'support@sinchflows.io' },
      username: { type: String, default: 'support@sinchflows.io' },
      encryptedPassword: { type: String, default: '' },
      tls: { type: Boolean, default: true },
      folder: { type: String, default: 'INBOX' },
      pollingIntervalSec: { type: Number, default: 30 },
      enabled: { type: Boolean, default: false }
    },
    smtp: {
      host: { type: String, default: 'smtp.sinchflows.io' },
      port: { type: Number, default: 587 },
      username: { type: String, default: '' },
      encryptedPassword: { type: String, default: '' },
      senderEmail: { type: String, default: 'support@sinchflows.io' },
      senderName: { type: String, default: 'Flows Helpdesk | Sinch Flows' },
      tls: { type: Boolean, default: true },
      enabled: { type: Boolean, default: false }
    },
    ticketDefaults: {
      idPrefix: { type: String, default: 'FLW-' },
      defaultStatus: { type: String, default: 'New' },
      defaultPriority: { type: String, default: 'Normal' },
      reopenWindowDays: { type: Number, default: 7 }
    },
    categories: [{ name: String, description: String, active: Boolean }],
    tags: [{ name: String, color: String }]
  },
  { timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, required: true },
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    target: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    details: { type: String, default: '' }
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    ticketNumber: { type: String, default: null },
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export const SlaPolicy = mongoose.model('SlaPolicy', slaPolicySchema);
export const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);
export const EmailRoutingRule = mongoose.model('EmailRoutingRule', emailRoutingRuleSchema);
export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
