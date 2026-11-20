import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { redis } from '../infra/redis.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';

const RBAC_CACHE_TTL_SEC = 300; // 5 minutes

export async function getCachedRolePermissions(roleId) {
    const key = `rbac:role:${roleId}`;
    const cached = await redis.get(key);
    if (cached) {
        return JSON.parse(cached);
    }
    const role = await Role.findById(roleId).lean();
    if (!role || role.status !== 'Active') return [];
    await redis.set(key, JSON.stringify(role.permissions), 'EX', RBAC_CACHE_TTL_SEC);
    return role.permissions;
}

export async function invalidateRoleCache(roleId) {
    await redis.del(`rbac:role:${roleId}`);
}

export async function authenticate(req, res, next) {
    try {
        const token = req.cookies?.flows_access_token;
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
        const user = await User.findById(payload.sub).lean();
        if (!user || user.status !== 'Active') {
            return res.status(401).json({ message: 'Session invalid or account disabled' });
        }

        const permissions = await getCachedRolePermissions(user.roleId.toString());
        req.user = {
            id: user._id.toString(),
            fullName: user.fullName,
            email: user.email,
            userType: user.userType,
            roleId: user.roleId.toString(),
            orgId: user.orgId ? user.orgId.toString() : null,
            isCustomer: user.userType === 'customer',
            permissions
        };

        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired access token' });
    }
}

export function requirePermission(permissionKey) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (!req.user.permissions.includes(permissionKey)) {
            return res.status(403).json({
                message: 'Access denied: insufficient RBAC permissions',
                requiredPermission: permissionKey
            });
        }
        next();
    };
}

/**
 * Enforces strict multi-tenant data isolation for external customer users.
 */
export function buildTenantTicketFilter(user, baseFilter = {}) {
    if (user.isCustomer) {
        if (!user.orgId) {
            return { _id: null }; // Fails closed if customer has no orgId
        }
        return { ...baseFilter, orgId: user.orgId };
    }
    return baseFilter;
}
