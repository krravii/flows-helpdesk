import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { User } from '../../models/User.js';
import { Ticket } from '../../models/Ticket.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { logAudit } from '../../utils/audit.js';

export const usersRouter = Router();
usersRouter.use(authenticate);

const createUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).default('Flows@2026!'),
  phone: z.string().optional(),
  userType: z.enum(['internal', 'customer']),
  roleId: z.string(),
  orgId: z.string().nullable().optional(),
  team: z.string().optional()
});

usersRouter.get('/', requirePermission('users.view'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.userType) filter.userType = req.query.userType;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.orgId) filter.orgId = req.query.orgId;
    if (req.query.search) {
      const rx = new RegExp(req.query.search, 'i');
      filter.$or = [{ fullName: rx }, { email: rx }];
    }

    const users = await User.find(filter)
      .populate('roleId', 'name type')
      .populate('orgId', 'name code primaryDomain')
      .sort({ fullName: 1 })
      .lean();

    res.json({ items: users });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/engineers/workload — Support Engineer Roster & Live Ticket Counts
usersRouter.get('/engineers/workload', requirePermission('engineers.view'), async (_req, res, next) => {
  try {
    const engineers = await User.find({ userType: 'internal', status: 'Active' })
      .populate('roleId', 'name')
      .sort({ fullName: 1 })
      .lean();

    const enriched = await Promise.all(
      engineers.map(async (eng) => {
        const [assignedCount, openCount, resolvedCount] = await Promise.all([
          Ticket.countDocuments({ assigneeId: eng._id }),
          Ticket.countDocuments({ assigneeId: eng._id, status: { $nin: ['Resolved', 'Closed'] } }),
          Ticket.countDocuments({ assigneeId: eng._id, status: { $in: ['Resolved', 'Closed'] } })
        ]);
        return { ...eng, assignedCount, openCount, resolvedCount };
      })
    );

    res.json({ items: enriched });
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/', requirePermission('users.create'), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await argon2.hash(data.password);
    const user = await User.create({
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      passwordHash,
      phone: data.phone || '',
      userType: data.userType,
      roleId: data.roleId,
      orgId: data.userType === 'customer' ? data.orgId : null,
      team: data.team || 'General Support'
    });

    await logAudit({
      req,
      action: 'User Created',
      module: 'Users',
      target: user.fullName,
      details: `Provisioned ${user.userType} account (${user.email})`
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/:id', requirePermission('users.edit'), async (req, res, next) => {
  try {
    const allowed = {};
    for (const k of ['fullName', 'phone', 'roleId', 'orgId', 'team', 'availability', 'status', 'preferences']) {
      if (req.body[k] !== undefined) allowed[k] = req.body[k];
    }
    const user = await User.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logAudit({
      req,
      action: 'User Updated',
      module: 'Users',
      target: user.fullName,
      details: `Updated fields: ${Object.keys(allowed).join(', ')}`
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});
