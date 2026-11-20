import { Router } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { User } from '../../models/User.js';
import { Role } from '../../models/Role.js';
import { Organisation } from '../../models/Organisation.js';
import { authenticate, getCachedRolePermissions } from '../../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function setAuthCookies(res, userId) {
  const accessToken = jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL
  });
  const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL
  });

  const baseCookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/'
  };

  res.cookie('flows_access_token', accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000
  });

  res.cookie('flows_refresh_token', refreshToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!user || user.status !== 'Active') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    setAuthCookies(res, user._id.toString());

    const role = await Role.findById(user.roleId).lean();
    const org = user.orgId ? await Organisation.findById(user.orgId).lean() : null;
    const permissions = await getCachedRolePermissions(user.roleId.toString());

    res.json({
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        team: user.team,
        availability: user.availability,
        preferences: user.preferences,
        role: role ? { id: role._id.toString(), name: role.name, type: role.type } : null,
        organisation: org ? { id: org._id.toString(), name: org.name, code: org.code } : null,
        permissions
      }
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.flows_refresh_token;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ message: 'Account disabled' });
    }

    setAuthCookies(res, user._id.toString());
    res.json({ ok: true });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  const role = await Role.findById(user.roleId).lean();
  const org = user.orgId ? await Organisation.findById(user.orgId).lean() : null;

  res.json({
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      team: user.team,
      availability: user.availability,
      preferences: user.preferences,
      role: role ? { id: role._id.toString(), name: role.name, type: role.type } : null,
      organisation: org ? { id: org._id.toString(), name: org.name, code: org.code } : null,
      permissions: req.user.permissions
    }
  });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('flows_access_token', { path: '/' });
  res.clearCookie('flows_refresh_token', { path: '/' });
  res.json({ ok: true });
});
