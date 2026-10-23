import { body, query, param } from 'express-validator';
import { STATUSES, PRIORITIES, SLA_STATES } from '../config/constants.js';

const password = (field) =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/[A-Za-z]/)
    .matches(/\d/)
    .withMessage('Password must contain a letter and a number');

const email = () => body('email').isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false });

export const registerRules = [
  body('name').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Name is required'),
  email(),
  password('password'),
];
export const loginRules = [email(), body('password').isString().notEmpty()];
export const forgotRules = [email()];
export const resetRules = [body('token').isString().isLength({ min: 32 }), password('password')];
export const changePasswordRules = [body('currentPassword').isString().notEmpty(), password('newPassword')];

const optionalDate = (f) => body(f).optional({ values: 'null' }).isISO8601().withMessage(`${f} must be an ISO date`).toDate();
const optionalMinutes = (f) =>
  body(f).optional({ values: 'null' }).isInt({ min: 0, max: 525600 }).withMessage(`${f} must be a non-negative integer`).toInt();

const taskFields = (isCreate) => [
  isCreate
    ? body('title').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Title is required (max 200 chars)')
    : body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 10000 }),
  body('status').optional().isIn(STATUSES),
  body('priority').optional().isIn(PRIORITIES),
  optionalDate('startAt'),
  optionalDate('dueAt'),
  optionalMinutes('estimatedDurationMinutes'),
  optionalMinutes('actualDurationMinutes'),
  optionalMinutes('timeSpentMinutes'),
  optionalMinutes('slaDurationMinutes'),
  body('assignee').optional({ values: 'falsy' }).isMongoId(),
  body('sectionId').optional({ values: 'falsy' }).isMongoId(),
  body('workspaceId').optional().isMongoId(),
  body('tags').optional().isArray({ max: 20 }),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 30 }),
  body('dueAt').custom((due, { req }) => {
    if (due && req.body.startAt && new Date(due) < new Date(req.body.startAt)) {
      throw new Error('Due date must be after start date');
    }
    return true;
  }),
];

export const createTaskRules = taskFields(true);
export const updateTaskRules = [param('id').isMongoId(), ...taskFields(false)];
export const idRule = [param('id').isMongoId()];
export const statusRules = [
  param('id').isMongoId(),
  body('status').isIn(STATUSES),
  body('sectionId').optional({ values: 'null' }).isMongoId(),
];
export const bulkRules = [
  body('ids').isArray({ min: 1, max: 200 }),
  body('ids.*').isMongoId(),
  body('action').isIn(['update', 'delete', 'complete']),
  body('changes.status').optional().isIn(STATUSES),
  body('changes.priority').optional().isIn(PRIORITIES),
  body('changes.sectionId').optional().isMongoId(),
];

const csvIn = (field, allowed) =>
  query(field)
    .optional()
    .custom((v) => String(v).split(',').every((s) => allowed.includes(s.trim())))
    .withMessage(`${field} must be one of: ${allowed.join(', ')}`);
const idList = (allowMe) => (v) => String(v).split(',').every((s) => (allowMe && s === 'me') || /^[a-f\d]{24}$/i.test(s));

export const listTaskRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  query(['search', 'title', 'description']).optional().isString().isLength({ max: 200 }),
  csvIn('status', STATUSES),
  csvIn('priority', PRIORITIES),
  csvIn('sla', SLA_STATES),
  query('sortBy')
    .optional()
    .isIn(['title', 'priority', 'createdAt', 'updatedAt', 'dueAt', 'startAt', 'duration', 'estimatedDurationMinutes', 'actualDurationMinutes', 'status', 'sla']),
  query('order').optional().isIn(['asc', 'desc']),
  query('view').optional().isIn(['all', 'my', 'today', 'upcoming', 'overdue', 'completed']),
  query('dueRange').optional().isIn(['today', 'tomorrow', 'week', 'overdue', 'none', 'upcoming']),
  query(['assignee', 'createdBy']).optional().custom(idList(true)),
  query('sectionId').optional().custom((s) => s === 'none' || idList(false)(s)),
  query('workspaceId').optional().custom(idList(false)),
  ...['created', 'updated', 'start', 'due', 'completed'].flatMap((k) => [
    query(`${k}From`).optional().isISO8601(),
    query(`${k}To`).optional().isISO8601(),
  ]),
  ...['est', 'actual', 'spent', 'slaDur'].flatMap((k) => [
    query(`${k}Min`).optional().isFloat({ min: 0 }),
    query(`${k}Max`).optional().isFloat({ min: 0 }),
  ]),
];

export const sectionCreateRules = [
  body('name').isString().trim().isLength({ min: 1, max: 60 }),
  body('workspaceId').optional().isMongoId(),
];
export const sectionUpdateRules = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 60 }),
  body('order').optional().isInt({ min: 0 }),
];
