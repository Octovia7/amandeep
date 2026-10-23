import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, errorMessage } from '../../services/api';

const thunk = (name, fn) =>
  createAsyncThunk(`auth/${name}`, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  });

export const login = thunk('login', async (body) => (await api.post('/auth/login', body)).data.data);
export const register = thunk('register', async (body) => (await api.post('/auth/register', body)).data.data);
export const restoreSession = thunk('restore', async () => (await api.post('/auth/refresh')).data.data);
export const logout = thunk('logout', async () => (await api.post('/auth/logout')).data.data);

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, accessToken: null, initialized: false, status: 'idle', error: null },
  reducers: {
    tokenRefreshed(state, { payload }) {
      state.accessToken = payload.accessToken;
      if (payload.user) state.user = payload.user;
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
    },
  },
  extraReducers: (b) => {
    const setSession = (state, { payload }) => {
      state.user = payload.user;
      state.accessToken = payload.accessToken;
      state.status = 'idle';
      state.error = null;
      state.initialized = true;
    };
    b.addCase(login.fulfilled, setSession)
      .addCase(register.fulfilled, setSession)
      .addCase(restoreSession.fulfilled, setSession)
      .addCase(restoreSession.rejected, (state) => {
        state.initialized = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
      })
      .addCase(logout.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
      });
    for (const t of [login, register]) {
      b.addCase(t.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      }).addCase(t.rejected, (state, { payload }) => {
        state.status = 'idle';
        state.error = payload;
      });
    }
  },
});

export const { tokenRefreshed, loggedOut } = authSlice.actions;
export default authSlice.reducer;
