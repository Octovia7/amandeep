# Taskflow: Full-Stack Todo Management System

A task manager with secure JWT authentication, three synchronized views (List, Section, Kanban), advanced server-side filtering, sorting and pagination, real SLA tracking, and a dashboard.

**Stack:** React 18 + Vite, Redux Toolkit, React Router, Tailwind CSS, Axios, Lucide, Day.js, @hello-pangea/dnd · Node.js + Express, MongoDB + Mongoose, bcrypt, JWT, express-validator, express-rate-limit, helmet · Jest + Supertest, Vitest + Testing Library.

## Quick start

Prerequisites: Node.js 18+ (tested on 22) and MongoDB 6+ running locally (or a MongoDB Atlas URI).

```bash
npm run install:all                 # installs server + client
cp server/.env.example server/.env  # adjust MONGO_URI / secrets if needed
npm run seed                        # demo data (local development only)
npm run dev:server                  # API on http://localhost:5000
npm run dev:client                  # app on http://localhost:5173
```

The default `MONGO_URI` is `mongodb://127.0.0.1:27017/todo_app`. With Docker you can start MongoDB with `docker run -d -p 27017:27017 mongo:7`.

### Demo accounts (local development only)

| Email | Password | Data |
|---|---|---|
| demo@example.com | Password123 | 60 tasks covering every status, priority and SLA state |
| second@example.com | Password123 | 5 tasks (useful for checking data isolation) |

`npm run seed` deletes and recreates **only** these two demo users and their workspaces.

### Tests

```bash
npm test               # server (Jest + Supertest) and client (Vitest)
```

Server integration tests use a throwaway database `todo_test_<timestamp>` on the local MongoDB, which they drop when they finish. Set `MONGO_URI_TEST` to use a different instance.

Coverage includes SLA boundary conditions (exactly at the at-risk threshold, at the deadline, one minute past it, completion exactly at the deadline), validation, register, login, refresh and logout revocation, single-use reset tokens, cross-user data isolation, Kanban status persistence and activity history, filtering, sorting and pagination, soft delete, and on the client form validation, the optimistic Kanban move with rollback, pagination and the SLA badge.

## Features

- **Auth:** registration, login and logout; short-lived access token (memory only, never in localStorage) plus an HttpOnly refresh-token cookie (`SameSite=Lax` in dev, `None; Secure` in production, scoped to `/api/auth`). Logout and password change revoke refresh tokens via a `tokenVersion`. Forgot and reset password use an expiring, single-use, SHA-256-hashed token. Login, register and reset are rate limited.
- **Authorization:** every task, section and dashboard query is scoped to workspaces where the authenticated user is a member. Client-supplied user IDs are never trusted for ownership. Cross-tenant access returns 404. Section management requires the Owner or Admin role.
- **Views:** List (sortable columns, inline status and priority editing, completion checkbox, bulk complete, status, priority and delete, page sizes 10/20/50/100), Section (collapsible groups with counts, add, rename and delete sections, move tasks, create inside a section, per-section "load more"), and Kanban (drag and drop persisted through `PATCH /tasks/:id/status`, optimistic with rollback and a toast on failure, per-column lazy loading, configurable visible columns).
- **Sync:** all views read from one normalized Redux `entities` map, and every mutation bumps a version counter so mounted views refetch their server-side slice.
- **Filters:** search (debounced, case-insensitive across title, description and tags); title and description; status, priority, tags, assignee and creator; section; created, updated, start, due and completed date ranges; presets for today, tomorrow, this week, overdue and no due date; numeric ranges for estimated, actual, time spent and SLA duration; SLA state. Filters combine with AND, show as removable chips, support clear-all, live in the URL, and reset to page 1 when they change.
- **Task model:** the fields from the spec, plus activity history (status, priority, due, assignee, section and title changes), soft delete, and indexes on the common query paths.
- **UI:** collapsible sidebar, mobile drawer navigation, top bar (global search with the `/` shortcut, notifications for at-risk and breached SLAs, theme toggle, profile menu), light, dark and system themes, skeletons, empty and error states, confirmation dialogs, toasts, and visible focus rings.

## SLA policy

- **Deadline** = `startAt` (or `createdAt` if there's no start) + `slaDurationMinutes`, stored as `slaDeadline` (UTC) so SLA filters run inside MongoDB.
- **Active tasks:** *On Track* while more than the threshold of the SLA window remains, *At Risk* once at most the threshold remains (the deadline itself counts as At Risk), and *Breached* after the deadline.
- **Completed tasks:** *Met* if `completedAt <= deadline`, otherwise *Missed*.
- **Threshold:** `SLA_AT_RISK_THRESHOLD` (default `0.2`, meaning 20%). It's configured in exactly one place, `server/src/config/env.js`.
- **Compliance:** met ÷ (met + missed) for tasks completed in the selected period. It returns `null` (shown as N/A) when there are no eligible tasks.
- SLA status is always computed on the server (`computeSla` for responses, `slaFilter` for queries; the two mirror each other and are unit-tested).
- Business-hour calendars aren't implemented; they're a documented extension point in `sla.service.js`.

## API

All responses use `{ success, data, pagination? }` or `{ success: false, error: { message, details? } }`. Validation errors return 422, auth errors 401, missing or foreign resources 404, conflicts 409.

| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/register | `{ name, email, password }` → `{ user, accessToken }` + refresh cookie |
| POST | /api/auth/login | `{ email, password }` |
| POST | /api/auth/refresh | uses the refresh cookie |
| POST | /api/auth/logout | revokes refresh tokens, clears the cookie |
| POST | /api/auth/forgot-password | `{ email }`; outside production the response includes `devResetToken`, and the link is also logged to the console (local alternative to email) |
| POST | /api/auth/reset-password | `{ token, password }` |
| POST | /api/auth/change-password | `{ currentPassword, newPassword }` (auth) |
| GET | /api/auth/me, /api/users/me | current user |
| GET | /api/tasks | filtering, sorting and pagination (see below) |
| POST | /api/tasks | create |
| GET / PATCH / DELETE | /api/tasks/:id | detail (includes activity), update, soft delete |
| PATCH | /api/tasks/:id/status | `{ status }` (used by Kanban) |
| PATCH | /api/tasks/:id/complete | `{ completed: true \| false }` |
| POST | /api/tasks/bulk-update | `{ ids, action: 'update' \| 'complete' \| 'delete', changes? }` |
| GET | /api/dashboard/stats | totals, completed, overdue, due today, SLA breaches, by status |
| GET | /api/dashboard/sla | `?from&to` (default last 30 days) |
| GET / POST | /api/sections | list and create |
| PATCH / DELETE | /api/sections/:id | rename or reorder; delete (its tasks become unsectioned) |
| GET | /api/workspaces | workspaces with members and roles |

**`GET /api/tasks` query parameters:** `page` (≥1), `limit` (1–100), `search`, `title`, `description`, `status` (CSV), `priority` (CSV), `tags` (CSV, all must match), `assignee` and `createdBy` (CSV of ids or `me`), `sectionId` (id or `none`), `workspaceId`, `view` (`my|today|upcoming|overdue|completed`), `dueRange` (`today|tomorrow|week|overdue|none`), `{created,updated,start,due,completed}{From,To}` (ISO dates), `{est,actual,spent,slaDur}{Min,Max}` (minutes), `sla` (CSV of `on_track,at_risk,breached,met,missed,none`), `sortBy` (`title|priority|createdAt|updatedAt|dueAt|startAt|duration|actualDurationMinutes|status|sla`), `order` (`asc|desc`).

Example: `GET /api/tasks?page=1&limit=10&status=In%20Progress&search=report&sortBy=dueAt&order=asc`

## Project structure

```
server/src  config/ models/ controllers/ services/ routes/ middleware/ validators/ utils/ app.js server.js
server/tests  sla.test.js  api.test.js
client/src  app/store.js  features/{auth,tasks,sections,ui}  components/{layout,common,tasks,filters,pagination}
            pages/  hooks/  services/api.js  utils/  routes/
```

## Design decisions and defaults

- **Single workspace per user:** each user gets a personal workspace (role Owner) with five default sections that mirror the statuses. The data model and permission checks support multiple members and roles (Owner, Admin, Member), but there's no UI for inviting members yet, so assignment is limited to workspace members.
- **Sections are independent of status:** Kanban groups by `status` and Section view groups by `sectionId`. New tasks default to the section whose name matches their status.
- **Offset pagination:** offset pagination with `countDocuments` for accurate totals. Every sort adds an `_id` tie-breaker so pages are stable. For very large datasets, swap to cursor pagination on `(sortField, _id)`.
- **Dates:** stored in UTC. The UI converts to and from the browser's local time zone.
- **Kanban column visibility:** a per-browser preference kept in localStorage. No task data is kept there.
