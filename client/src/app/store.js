import { configureStore } from '@reduxjs/toolkit';
import auth, { tokenRefreshed, loggedOut } from '../features/auth/authSlice';
import tasks from '../features/tasks/tasksSlice';
import sections from '../features/sections/sectionsSlice';
import ui from '../features/ui/uiSlice';
import { setupInterceptors } from '../services/api';

export const store = configureStore({ reducer: { auth, tasks, sections, ui } });

setupInterceptors(store, { tokenRefreshed, loggedOut });
