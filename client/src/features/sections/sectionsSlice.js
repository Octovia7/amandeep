import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, errorMessage } from '../../services/api';

const thunk = (name, fn) =>
  createAsyncThunk(`sections/${name}`, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  });

export const fetchSections = thunk('fetch', async () => (await api.get('/sections')).data.data);
export const createSection = thunk('create', async (name) => (await api.post('/sections', { name })).data.data);
export const renameSection = thunk('rename', async ({ id, name }) => (await api.patch(`/sections/${id}`, { name })).data.data);
export const deleteSection = thunk('delete', async (id) => {
  await api.delete(`/sections/${id}`);
  return id;
});

const sectionsSlice = createSlice({
  name: 'sections',
  initialState: { items: [], status: 'idle' },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchSections.pending, (s) => {
      s.status = 'loading';
    })
      .addCase(fetchSections.fulfilled, (s, { payload }) => {
        s.items = payload;
        s.status = 'idle';
      })
      .addCase(fetchSections.rejected, (s) => {
        s.status = 'error';
      })
      .addCase(createSection.fulfilled, (s, { payload }) => {
        s.items.push(payload);
      })
      .addCase(renameSection.fulfilled, (s, { payload }) => {
        s.items = s.items.map((x) => (x._id === payload._id ? payload : x));
      })
      .addCase(deleteSection.fulfilled, (s, { payload }) => {
        s.items = s.items.filter((x) => x._id !== payload);
      });
  },
});

export default sectionsSlice.reducer;
