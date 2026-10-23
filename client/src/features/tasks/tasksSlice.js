import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, errorMessage } from '../../services/api';

/*
 * Every view (List, Section, Kanban, details drawer) reads task objects from the single
 * `entities` map; views only hold ordered id lists. Editing a task in one place therefore
 * updates it everywhere, and every successful mutation bumps `version` so mounted views refetch
 * their server-side filtered/paginated slices.
 */

const thunk = (name, fn) =>
  createAsyncThunk(`tasks/${name}`, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  });

export const fetchTasks = thunk('fetchList', async (params) => (await api.get('/tasks', { params })).data);
export const fetchGroup = thunk('fetchGroup', async ({ key, params, append }) => ({
  key,
  append,
  ...(await api.get('/tasks', { params })).data,
}));
export const fetchTask = thunk('fetchOne', async (id) => (await api.get(`/tasks/${id}`)).data.data);
export const createTask = thunk('create', async (body) => (await api.post('/tasks', body)).data.data);
export const updateTask = thunk('update', async ({ id, changes }) => (await api.patch(`/tasks/${id}`, changes)).data.data);
export const toggleComplete = thunk('complete', async ({ id, completed }) => (await api.patch(`/tasks/${id}/complete`, { completed })).data.data);
export const deleteTask = thunk('delete', async (id) => {
  await api.delete(`/tasks/${id}`);
  return id;
});
export const bulkUpdate = thunk('bulk', async (body) => (await api.post('/tasks/bulk-update', body)).data.data);

/** Kanban move: optimistic, with rollback on failure (see reducers below). */
export const moveTask = createAsyncThunk('tasks/move', async ({ id, status }, { rejectWithValue }) => {
  try {
    return (await api.patch(`/tasks/${id}/status`, { status })).data.data;
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

const emptyGroup = { ids: [], pagination: null, status: 'idle', error: null };

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: {
    entities: {},
    list: { ...emptyGroup },
    groups: {},
    selected: [],
    version: 0,
    snapshot: null,
  },
  reducers: {
    toggleSelected(state, { payload }) {
      state.selected = state.selected.includes(payload)
        ? state.selected.filter((id) => id !== payload)
        : [...state.selected, payload];
    },
    setSelected(state, { payload }) {
      state.selected = payload;
    },
  },
  extraReducers: (b) => {
    const upsert = (state, tasks) => {
      for (const t of tasks) state.entities[t.id] = { ...state.entities[t.id], ...t };
    };
    const bump = (state, { payload }) => {
      upsert(state, [payload]);
      state.version += 1;
    };

    b.addCase(fetchTasks.pending, (state) => {
      state.list.status = 'loading';
      state.list.error = null;
    })
      .addCase(fetchTasks.fulfilled, (state, { payload }) => {
        upsert(state, payload.data);
        state.list = { ids: payload.data.map((t) => t.id), pagination: payload.pagination, status: 'idle', error: null };
        state.selected = state.selected.filter((id) => state.list.ids.includes(id));
      })
      .addCase(fetchTasks.rejected, (state, { payload }) => {
        state.list.status = 'error';
        state.list.error = payload;
      })
      .addCase(fetchGroup.pending, (state, { meta }) => {
        const g = state.groups[meta.arg.key] || { ...emptyGroup };
        state.groups[meta.arg.key] = { ...g, status: meta.arg.append ? 'loadingMore' : 'loading', error: null };
      })
      .addCase(fetchGroup.fulfilled, (state, { payload }) => {
        upsert(state, payload.data);
        const prev = state.groups[payload.key]?.ids || [];
        const ids = payload.data.map((t) => t.id);
        state.groups[payload.key] = {
          ids: payload.append ? [...prev, ...ids.filter((id) => !prev.includes(id))] : ids,
          pagination: payload.pagination,
          status: 'idle',
          error: null,
        };
      })
      .addCase(fetchGroup.rejected, (state, { payload, meta }) => {
        state.groups[meta.arg.key] = { ...(state.groups[meta.arg.key] || emptyGroup), status: 'error', error: payload };
      })
      .addCase(fetchTask.fulfilled, (state, { payload }) => upsert(state, [payload]))
      .addCase(createTask.fulfilled, bump)
      .addCase(updateTask.fulfilled, bump)
      .addCase(toggleComplete.fulfilled, bump)
      .addCase(deleteTask.fulfilled, (state, { payload }) => {
        delete state.entities[payload];
        state.selected = state.selected.filter((id) => id !== payload);
        state.version += 1;
      })
      .addCase(bulkUpdate.fulfilled, (state) => {
        state.selected = [];
        state.version += 1;
      })
      .addCase(moveTask.pending, (state, { meta }) => {
        const { id, status, fromKey, toKey } = meta.arg;
        state.snapshot = { task: { ...state.entities[id] }, groups: JSON.parse(JSON.stringify(state.groups)) };
        state.entities[id] = { ...state.entities[id], status };
        if (fromKey && toKey && state.groups[fromKey] && state.groups[toKey]) {
          state.groups[fromKey].ids = state.groups[fromKey].ids.filter((x) => x !== id);
          state.groups[toKey].ids = [id, ...state.groups[toKey].ids.filter((x) => x !== id)];
        }
      })
      .addCase(moveTask.fulfilled, (state, action) => {
        state.snapshot = null;
        bump(state, action);
      })
      .addCase(moveTask.rejected, (state, { meta }) => {
        if (state.snapshot) {
          state.entities[meta.arg.id] = state.snapshot.task;
          state.groups = state.snapshot.groups;
        }
        state.snapshot = null;
      })
      // Drop cached tasks when the user logs out so the next user never sees them
      .addMatcher(
        (a) => a.type === 'auth/logout/fulfilled' || a.type === 'auth/logout/rejected' || a.type === 'auth/loggedOut',
        () => ({ entities: {}, list: { ...emptyGroup }, groups: {}, selected: [], version: 0, snapshot: null })
      );
  },
});

export const { toggleSelected, setSelected } = tasksSlice.actions;
export default tasksSlice.reducer;
