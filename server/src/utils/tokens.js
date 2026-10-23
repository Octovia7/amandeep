import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export const REFRESH_COOKIE = 'refreshToken';

export const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id) }, env.jwtAccessSecret, { expiresIn: env.accessTokenTtl });

export const signRefreshToken = (user) =>
  jwt.sign({ sub: String(user._id), v: user.tokenVersion }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
});

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');
