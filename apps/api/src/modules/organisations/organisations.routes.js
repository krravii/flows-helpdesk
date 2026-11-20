import { Router } from 'express';
import { z } from 'zod';
import { Organisation } from '../../models/Organisation.js';
import { User } from '../../models/User.js';
import { Ticket } from '../../models/Ticket.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { logAudit } from '../../utils/audit.js';

export const organisationsRouter = Router();
organisationsRouter.use(authenticate);

const orgSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(6),
  description: z.string().optional(),
  primaryDomain: z.string().min(3),
  additionalDomains: z.array(z.string()).default([]),
  registeredEmails: z.array(z.string().email()).default([]),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  notes: z.string().optional()
});

organisationsRouter.get('/', requirePermission('orgs.view'), async (req, res, next) => {
  try {
    const filter = req.user.isCustomer ? { _id: req.user.orgId } : {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: rx }, { primaryDomain: rx }, { contactPerson: rx }];
    }

    const orgs = await Organisation.find(filter).sort({ name: 1 }).lean();

    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const [userCount, totalTickets, openTickets] = await Promise.all([
          User.countDocuments({ orgId: org._id }),
          Ticket.countDocuments({ orgId: org._id }),
          Ticket.countDocuments({ orgId: org._id, status: { $nin: ['Resolved', 'Closed'] } })
        ]);
        return { ...org, userCount, totalTickets, openTickets };
      })
    );

    res.json({ items: enriched });
  } catch (err) {
    next(err);
  }
});

organisationsRouter.get('/:id', requirePermission('orgs.view'), async (req, res, next) => {
  try {
    if (req.user.isCustomer && req.user.orgId !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const org = await Organisation.findById(req.params.id).lean();
    if (!org) return res.status(404).json({ message: 'Organisation not found' });

    const [users, tickets] = await Promise.all([
      User.find({ orgId: org._id }).select('-passwordHash').lean(),
      Ticket.find({ orgId: org._id })
        .populate('assigneeId', 'fullName email')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean()
    ]);

    res.json({ organisation: org, users, tickets });
  } catch (err) {
    next(err);
  }
});

organisationsRouter.post('/', requirePermission('orgs.create'), async (req, res, next) => {
  try {
    const data = orgSchema.parse(req.body);
    const org = await Organisation.create({ ...data, domainVerified: true });
    await logAudit({
      req,
      action: 'Organisation Created',
      module: 'Organisations',
      target: org.name,
      details: `Created organisation with primary domain ${org.primaryDomain}`
    });
    res.status(201).json({ organisation: org });
  } catch (err) {
    next(err);
  }
});

organisationsRouter.patch('/:id', requirePermission('orgs.edit'), async (req, res, next) => {
  try {
    const org = await Organisation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    await logAudit({
      req,
      action: 'Organisation Updated',
      module: 'Organisations',
      target: org.name,
      details: 'Updated organisation settings or routing domains'
    });
    res.json({ organisation: org });
  } catch (err) {
    next(err);
  }
});
