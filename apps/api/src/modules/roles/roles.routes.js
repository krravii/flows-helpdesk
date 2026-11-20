import { Router } from 'express';
import { z } from 'zod';
import { PERMISSION_KEYS } from '@flows-helpdesk/shared';
import { Role } from '../../models/Role.js';
import { User } from '../../models/User.js';
import { authenticate, requirePermission, invalidateRoleCache } from '../../middleware/auth.js';
import { logAudit } from '../../utils/audit.js';

export const rolesRouter = Router();
rolesRouter.use(authenticate);

const roleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  permissions: z.array(z.enum(PERMISSION_KEYS)).default([])
});

rolesRouter.get('/', requirePermission('roles.view'), async (_req, res, next) => {
  try {
    const roles = await Role.find().sort({ type: -1, name: 1 }).lean();
    const enriched = await Promise.all(
      roles.map(async (r) => {
        const userCount = await User.countDocuments({ roleId: r._id });
        return { ...r, userCount };
      })
    );
    res.json({ items: enriched, allPermissionKeys: PERMISSION_KEYS });
  } catch (err) {
    next(err);
  }
});

rolesRouter.post('/', requirePermission('roles.create'), async (req, res, next) => {
  try {
    const data = roleSchema.parse(req.body);
    const role = await Role.create({ ...data, type: 'Custom' });
    await logAudit({
      req,
      action: 'Role Created',
      module: 'Roles & Permissions',
      target: role.name,
      details: `Created custom role with ${role.permissions.length} permissions`
    });
    res.status(201).json({ role });
  } catch (err) {
    next(err);
  }
});

rolesRouter.patch('/:id', requirePermission('roles.permissions'), async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    if (req.body.name && role.type === 'Custom') role.name = req.body.name;
    if (req.body.description !== undefined) role.description = req.body.description;
    if (Array.isArray(req.body.permissions)) {
      role.permissions = req.body.permissions;
    }

    await role.save();
    await invalidateRoleCache(role._id.toString());

    await logAudit({
      req,
      action: 'Permission Changed',
      module: 'Roles & Permissions',
      target: role.name,
      details: `Updated permissions (${role.permissions.length} grants active) and invalidated Redis RBAC cache`
    });

    res.json({ role });
  } catch (err) {
    next(err);
  }
});

rolesRouter.delete('/:id', requirePermission('roles.delete'), async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.type === 'System') {
      return res.status(400).json({ message: 'System roles cannot be deleted' });
    }
    const assignedUsers = await User.countDocuments({ roleId: role._id });
    if (assignedUsers > 0) {
      return res.status(400).json({ message: `Cannot delete role while ${assignedUsers} user(s) are assigned to it` });
    }
    await role.deleteOne();
    await invalidateRoleCache(role._id.toString());
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
