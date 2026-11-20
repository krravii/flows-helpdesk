import { Router } from 'express';
import { Ticket } from '../../models/Ticket.js';
import { Organisation } from '../../models/Organisation.js';
import { User } from '../../models/User.js';
import {
  SlaPolicy,
  EmailTemplate,
  EmailRoutingRule,
  SystemSetting,
  AuditLog,
  Notification
} from '../../models/AdminModels.js';
import { authenticate, requirePermission, buildTenantTicketFilter } from '../../middleware/auth.js';
import { encryptSecret } from '../../utils/crypto.js';
import { logAudit } from '../../utils/audit.js';

export const adminRouter = Router();
adminRouter.use(authenticate);

// GET /api/admin/dashboard — Role-Scoped Live KPIs & Chart Aggregations
adminRouter.get('/dashboard', requirePermission('dashboard.view'), async (req, res, next) => {
  try {
    const baseFilter = buildTenantTicketFilter(req.user, {});
    const [
      total,
      newCount,
      openCount,
      inProgressCount,
      waitingCustCount,
      resolvedCount,
      closedCount,
      unassignedCount,
      slaBreaches,
      slaWarnings,
      myAssignedCount
    ] = await Promise.all([
      Ticket.countDocuments(baseFilter),
      Ticket.countDocuments({ ...baseFilter, status: 'New' }),
      Ticket.countDocuments({ ...baseFilter, status: 'Open' }),
      Ticket.countDocuments({ ...baseFilter, status: 'In Progress' }),
      Ticket.countDocuments({ ...baseFilter, status: 'Waiting for Customer' }),
      Ticket.countDocuments({ ...baseFilter, status: 'Resolved' }),
      Ticket.countDocuments({ ...baseFilter, status: 'Closed' }),
      req.user.isCustomer ? 0 : Ticket.countDocuments({ assigneeId: null, status: { $nin: ['Resolved', 'Closed'] } }),
      req.user.isCustomer ? 0 : Ticket.countDocuments({ 'sla.status': 'Breached' }),
      req.user.isCustomer ? 0 : Ticket.countDocuments({ 'sla.status': 'Warning' }),
      Ticket.countDocuments(
        req.user.isCustomer ? { ...baseFilter, requesterId: req.user.id } : { assigneeId: req.user.id }
      )
    ]);

    const recentTickets = await Ticket.find(baseFilter)
      .populate('orgId', 'name code')
      .populate('assigneeId', 'fullName')
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean();

    const byOrg = req.user.isCustomer
      ? []
      : await Ticket.aggregate([
          { $match: { orgId: { $ne: null } } },
          { $group: { _id: '$orgId', count: { $sum: 1 } } },
          { $lookup: { from: 'organisations', localField: '_id', foreignField: '_id', as: 'org' } },
          { $unwind: '$org' },
          { $project: { name: '$org.name', count: 1 } },
          { $sort: { count: -1 } }
        ]);

    res.json({
      kpis: {
        total,
        newCount,
        openCount,
        inProgressCount,
        waitingCustCount,
        resolvedCount,
        closedCount,
        unassignedCount,
        slaBreaches,
        slaWarnings,
        myAssignedCount
      },
      byOrg,
      recentTickets
    });
  } catch (err) {
    next(err);
  }
});

// SLA Policies
adminRouter.get('/sla', requirePermission('settings.view'), async (_req, res, next) => {
  try {
    const items = await SlaPolicy.find().lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/sla/:id', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const item = await SlaPolicy.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// Email Configuration (IMAP & SMTP)
adminRouter.get('/email-config', requirePermission('email.view'), async (_req, res, next) => {
  try {
    const settings = await SystemSetting.findById('global').lean();
    const rules = await EmailRoutingRule.find().populate('orgId', 'name').sort({ priority: 1 }).lean();
    if (settings?.imap?.encryptedPassword) settings.imap.encryptedPassword = '••••••••••••';
    if (settings?.smtp?.encryptedPassword) settings.smtp.encryptedPassword = '••••••••••••';
    res.json({ settings, rules });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/email-config', requirePermission('email.imap_edit'), async (req, res, next) => {
  try {
    const update = {};
    if (req.body.imap) {
      const imap = { ...req.body.imap };
      if (imap.password && !imap.password.startsWith('••')) {
        imap.encryptedPassword = encryptSecret(imap.password);
      }
      delete imap.password;
      update.imap = imap;
    }
    if (req.body.smtp) {
      const smtp = { ...req.body.smtp };
      if (smtp.password && !smtp.password.startsWith('••')) {
        smtp.encryptedPassword = encryptSecret(smtp.password);
      }
      delete smtp.password;
      update.smtp = smtp;
    }
    const settings = await SystemSetting.findByIdAndUpdate('global', { $set: update }, { new: true, upsert: true });
    await logAudit({
      req,
      action: 'Email Configuration Updated',
      module: 'Email Configuration',
      target: 'IMAP / SMTP',
      details: 'Updated inbound IMAP or outbound SMTP server settings'
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Email Templates
adminRouter.get('/email-templates', requirePermission('templates.view'), async (_req, res, next) => {
  try {
    const items = await EmailTemplate.find().sort({ name: 1 }).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/email-templates/:id', requirePermission('templates.edit'), async (req, res, next) => {
  try {
    const tpl = await EmailTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ template: tpl });
  } catch (err) {
    next(err);
  }
});

// System Settings (Categories & Tags)
adminRouter.get('/settings', requirePermission('settings.view'), async (_req, res, next) => {
  try {
    const settings = await SystemSetting.findById('global').lean();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/settings', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const settings = await SystemSetting.findByIdAndUpdate('global', { $set: req.body }, { new: true, upsert: true });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Audit Logs
adminRouter.get('/audit-logs', requirePermission('audit.view'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.module) filter.module = req.query.module;
    const items = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// Notifications
adminRouter.get('/notifications', async (req, res, next) => {
  try {
    const items = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/notifications/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
