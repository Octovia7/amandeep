import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError, ok } from '../utils/http.js';
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  sha256,
  randomToken,
} from '../utils/tokens.js';
import { createPersonalWorkspace } from '../services/workspace.service.js';

function issueTokens(res, user) {
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), refreshCookieOptions());
  return signAccessToken(user);
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw new ApiError(409, 'Email is already registered');
  const user = await User.create({ name, email, password });
  await createPersonalWorkspace(user);
  const accessToken = issueTokens(res, user);
  ok(res, { user, accessToken }, {}, 201);
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +tokenVersion');
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid email or password');
  const accessToken = issueTokens(res, user);
  ok(res, { user, accessToken });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new ApiError(401, 'No refresh token');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtRefreshSecret);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.v) throw new ApiError(401, 'Refresh token revoked');
  const accessToken = issueTokens(res, user);
  ok(res, { user, accessToken });
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, env.jwtRefreshSecret);
      await User.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
    } catch {
      /* already invalid */
    }
  }
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  ok(res, { message: 'Logged out' });
}

export async function me(req, res) {
  ok(res, { user: req.user });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  user.password = req.body.newPassword;
  user.tokenVersion += 1;
  await user.save();
  const accessToken = issueTokens(res, user);
  ok(res, { message: 'Password updated', accessToken });
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  const response = { message: 'If that email exists, a reset link has been sent.' };
  if (user) {
    const token = randomToken();
    user.resetTokenHash = sha256(token);
    user.resetTokenExpires = new Date(Date.now() + env.resetTokenTtlMinutes * 60000);
    await user.save();
    // Local-development alternative to an email provider: log the link, and expose it outside production.
    const link = `${env.clientOrigins[0]}/reset-password?token=${token}`;
    if (!env.isTest) console.log(`[password-reset] ${user.email}: ${link}`);
    if (!env.isProd) response.devResetToken = token;
  }
  ok(res, response);
}

export async function resetPassword(req, res) {
  const user = await User.findOne({
    resetTokenHash: sha256(req.body.token),
    resetTokenExpires: { $gt: new Date() },
  }).select('+tokenVersion');
  if (!user) throw new ApiError(400, 'Reset token is invalid or has expired');
  user.password = req.body.password;
  user.resetTokenHash = undefined; // single-use
  user.resetTokenExpires = undefined;
  user.tokenVersion += 1;
  await user.save();
  ok(res, { message: 'Password has been reset. Please log in.' });
}
