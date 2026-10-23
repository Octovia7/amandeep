import * as service from '../services/task.service.js';
import { ok } from '../utils/http.js';

export async function list(req, res) {
  const { data, pagination } = await service.listTasks(req.user, req.query);
  ok(res, data, { pagination });
}
export async function get(req, res) {
  ok(res, await service.getTask(req.user, req.params.id));
}
export async function create(req, res) {
  ok(res, await service.createTask(req.user, req.body), {}, 201);
}
export async function update(req, res) {
  ok(res, await service.updateTask(req.user, req.params.id, req.body));
}
export async function updateStatus(req, res) {
  const body = { status: req.body.status };
  if (req.body.sectionId !== undefined) body.sectionId = req.body.sectionId;
  ok(res, await service.updateTask(req.user, req.params.id, body));
}
export async function complete(req, res) {
  const status = req.body.completed === false ? 'To Do' : 'Done';
  ok(res, await service.updateTask(req.user, req.params.id, { status }));
}
export async function remove(req, res) {
  await service.deleteTask(req.user, req.params.id);
  ok(res, { id: req.params.id });
}
export async function bulk(req, res) {
  ok(res, await service.bulkUpdate(req.user, req.body));
}
