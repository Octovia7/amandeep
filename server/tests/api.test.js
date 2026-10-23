process.env.NODE_ENV = 'test';
// Each run uses its own throwaway database on the local MongoDB instance and drops it afterwards.
process.env.MONGO_URI = process.env.MONGO_URI_TEST || `mongodb://127.0.0.1:27017/todo_test_${Date.now()}`;

const { default: request } = await import('supertest');
const { default: mongoose } = await import('mongoose');
const { createApp } = await import('../src/app.js');
const { connectDb } = await import('../src/config/db.js');

const app = createApp();
const api = request(app);

async function registerUser(email) {
  const res = await api.post('/api/auth/register').send({ name: 'Test', email, password: 'Password123' });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, cookie: res.headers['set-cookie'], user: res.body.data.user };
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

let alice;
let bob;

beforeAll(async () => {
  await connectDb(process.env.MONGO_URI);
  alice = await registerUser('alice@test.dev');
  bob = await registerUser('bob@test.dev');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('auth', () => {
  test('rejects duplicate registration', async () => {
    const res = await api.post('/api/auth/register').send({ name: 'x', email: 'alice@test.dev', password: 'Password123' });
    expect(res.status).toBe(409);
  });
  test('rejects weak password', async () => {
    const res = await api.post('/api/auth/register').send({ name: 'x', email: 'w@test.dev', password: 'short' });
    expect(res.status).toBe(422);
  });
  test('login sets an HttpOnly refresh cookie and never returns the password', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'alice@test.dev', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });
  test('wrong password is rejected', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'alice@test.dev', password: 'Wrong12345' });
    expect(res.status).toBe(401);
  });
  test('protected routes require a token', async () => {
    expect((await api.get('/api/tasks')).status).toBe(401);
  });
  test('refresh issues a new access token, logout revokes it', async () => {
    const login = await api.post('/api/auth/login').send({ email: 'bob@test.dev', password: 'Password123' });
    const cookie = login.headers['set-cookie'];
    const r1 = await api.post('/api/auth/refresh').set('Cookie', cookie);
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeTruthy();
    await api.post('/api/auth/logout').set('Cookie', cookie);
    const r2 = await api.post('/api/auth/refresh').set('Cookie', cookie);
    expect(r2.status).toBe(401);
  });
  test('password reset token is single-use', async () => {
    await registerUser('reset@test.dev');
    const f = await api.post('/api/auth/forgot-password').send({ email: 'reset@test.dev' });
    const token = f.body.data.devResetToken;
    expect(token).toBeTruthy();
    const r1 = await api.post('/api/auth/reset-password').send({ token, password: 'NewPassword1' });
    expect(r1.status).toBe(200);
    const r2 = await api.post('/api/auth/reset-password').send({ token, password: 'NewPassword2' });
    expect(r2.status).toBe(400);
    const login = await api.post('/api/auth/login').send({ email: 'reset@test.dev', password: 'NewPassword1' });
    expect(login.status).toBe(200);
  });
});

describe('tasks', () => {
  let taskId;

  test('creates a task with validation', async () => {
    const bad = await api.post('/api/tasks').set(auth(alice.token)).send({ title: '', estimatedDurationMinutes: -5 });
    expect(bad.status).toBe(422);
    const badDates = await api
      .post('/api/tasks')
      .set(auth(alice.token))
      .send({ title: 'x', startAt: '2026-01-02T00:00:00Z', dueAt: '2026-01-01T00:00:00Z' });
    expect(badDates.status).toBe(422);

    const res = await api
      .post('/api/tasks')
      .set(auth(alice.token))
      .send({ title: 'Write Report', priority: 'High', tags: ['Docs'], slaDurationMinutes: 60 });
    expect(res.status).toBe(201);
    expect(res.body.data.tags).toEqual(['docs']);
    expect(res.body.data.slaStatus).toBe('on_track');
    taskId = res.body.data.id;
  });

  test('cross-user isolation: bob cannot read, update or delete alice\'s task', async () => {
    expect((await api.get(`/api/tasks/${taskId}`).set(auth(bob.token))).status).toBe(404);
    expect((await api.patch(`/api/tasks/${taskId}`).set(auth(bob.token)).send({ title: 'hack' })).status).toBe(404);
    expect((await api.delete(`/api/tasks/${taskId}`).set(auth(bob.token))).status).toBe(404);
    const list = await api.get('/api/tasks').set(auth(bob.token));
    expect(list.body.pagination.totalItems).toBe(0);
  });

  test('Kanban status change persists, records activity and completes the task', async () => {
    const res = await api.patch(`/api/tasks/${taskId}/status`).set(auth(alice.token)).send({ status: 'Done' });
    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).toBeTruthy();
    expect(res.body.data.slaStatus).toBe('met');
    const detail = await api.get(`/api/tasks/${taskId}`).set(auth(alice.token));
    expect(detail.body.data.activity.some((a) => a.field === 'status' && a.to === 'Done')).toBe(true);
    const invalid = await api.patch(`/api/tasks/${taskId}/status`).set(auth(alice.token)).send({ status: 'Nope' });
    expect(invalid.status).toBe(422);
  });

  test('filtering, sorting and pagination', async () => {
    for (let i = 0; i < 12; i++) {
      await api
        .post('/api/tasks')
        .set(auth(alice.token))
        .send({ title: `Item ${String(i).padStart(2, '0')}`, priority: i % 2 ? 'Low' : 'Urgent', estimatedDurationMinutes: i * 10 });
    }
    const page1 = await api.get('/api/tasks?page=1&limit=5&sortBy=title&order=asc&search=item').set(auth(alice.token));
    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.data[0].title).toBe('Item 00');
    expect(page1.body.pagination).toMatchObject({ totalItems: 12, totalPages: 3, hasNextPage: true, hasPreviousPage: false });

    const page3 = await api.get('/api/tasks?page=3&limit=5&sortBy=title&order=asc&search=item').set(auth(alice.token));
    expect(page3.body.data).toHaveLength(2);
    expect(page3.body.pagination.hasNextPage).toBe(false);

    const urgent = await api.get('/api/tasks?priority=Urgent&estMin=50').set(auth(alice.token));
    expect(urgent.body.data.every((t) => t.priority === 'Urgent' && t.estimatedDurationMinutes >= 50)).toBe(true);
    expect(urgent.body.pagination.totalItems).toBe(3);

    const ci = await api.get('/api/tasks?title=WRITE').set(auth(alice.token));
    expect(ci.body.pagination.totalItems).toBe(1);

    const met = await api.get('/api/tasks?sla=met').set(auth(alice.token));
    expect(met.body.pagination.totalItems).toBe(1);

    expect((await api.get('/api/tasks?limit=1000').set(auth(alice.token))).status).toBe(422);
    expect((await api.get('/api/tasks?status=Bogus').set(auth(alice.token))).status).toBe(422);
  });

  test('soft delete hides the task', async () => {
    expect((await api.delete(`/api/tasks/${taskId}`).set(auth(alice.token))).status).toBe(200);
    expect((await api.get(`/api/tasks/${taskId}`).set(auth(alice.token))).status).toBe(404);
  });
});
