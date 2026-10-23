import { createSlice, nanoid } from '@reduxjs/toolkit';

const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

export function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: read('theme', 'system'),
    sidebarCollapsed: read('sidebarCollapsed', 'false') === 'true',
    mobileNavOpen: false,
    toasts: [],
    drawer: { open: false, taskId: null, defaults: null },
  },
  reducers: {
    setTheme(state, { payload }) {
      state.theme = payload;
      write('theme', payload);
      applyTheme(payload);
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      write('sidebarCollapsed', String(state.sidebarCollapsed));
    },
    setMobileNav(state, { payload }) {
      state.mobileNavOpen = payload;
    },
    pushToast: {
      reducer(state, { payload }) {
        state.toasts.push(payload);
      },
      prepare: (message, type = 'success') => ({ payload: { id: nanoid(), message, type } }),
    },
    dismissToast(state, { payload }) {
      state.toasts = state.toasts.filter((t) => t.id !== payload);
    },
    openDrawer(state, { payload = {} }) {
      state.drawer = { open: true, taskId: payload.taskId || null, defaults: payload.defaults || null };
    },
    closeDrawer(state) {
      state.drawer = { open: false, taskId: null, defaults: null };
    },
  },
});

export const { setTheme, toggleSidebar, setMobileNav, pushToast, dismissToast, openDrawer, closeDrawer } = uiSlice.actions;
export default uiSlice.reducer;
