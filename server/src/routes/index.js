import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler as h } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/error.js';
import { env } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import * as tasks from '../controllers/task.controller.js';
import * as misc from '../controllers/misc.controller.js';
import * as v from '../validators/index.js';

const limiter = (max) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.isTest ? 1000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many requests, please try again later' } },
  });

const router = Router();

/* Auth */
router.post('/auth/register', limiter(20), v.registerRules, validate, h(auth.register));
router.post('/auth/login', limiter(10), v.loginRules, validate, h(auth.login));
router.post('/auth/logout', h(auth.logout));
router.post('/auth/refresh', h(auth.refresh));
router.post('/auth/forgot-password', limiter(5), v.forgotRules, validate, h(auth.forgotPassword));
router.post('/auth/reset-password', limiter(10), v.resetRules, validate, h(auth.resetPassword));
router.get('/auth/me', requireAuth, h(auth.me));
router.post('/auth/change-password', requireAuth, v.changePasswordRules, validate, h(auth.changePassword));

/* Everything below requires authentication */
router.use(requireAuth);

router.get('/tasks', v.listTaskRules, validate, h(tasks.list));
router.post('/tasks', v.createTaskRules, validate, h(tasks.create));
router.post('/tasks/bulk-update', v.bulkRules, validate, h(tasks.bulk));
router.get('/tasks/:id', v.idRule, validate, h(tasks.get));
router.patch('/tasks/:id', v.updateTaskRules, validate, h(tasks.update));
router.delete('/tasks/:id', v.idRule, validate, h(tasks.remove));
router.patch('/tasks/:id/status', v.statusRules, validate, h(tasks.updateStatus));
router.patch('/tasks/:id/complete', v.idRule, validate, h(tasks.complete));

router.get('/dashboard/stats', h(misc.stats));
router.get('/dashboard/sla', h(misc.slaSummary));

router.get('/sections', h(misc.listSections));
router.post('/sections', v.sectionCreateRules, validate, h(misc.createSection));
router.patch('/sections/:id', v.sectionUpdateRules, validate, h(misc.updateSection));
router.delete('/sections/:id', v.idRule, validate, h(misc.deleteSection));

router.get('/workspaces', h(misc.listWorkspaces));
router.get('/users/me', h(misc.currentUser));

export default router;
