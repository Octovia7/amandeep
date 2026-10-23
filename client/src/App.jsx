import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { restoreSession } from './features/auth/authSlice';
import { applyTheme } from './features/ui/uiSlice';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import { Toasts } from './components/common/Feedback';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages';
import { SettingsPage, WorkspacesPage } from './pages/SettingsPage';

export default function App() {
  const dispatch = useDispatch();
  const initialized = useSelector((s) => s.auth.initialized);
  const theme = useSelector((s) => s.ui.theme);

  useEffect(() => {
    // Access token is memory-only, so on load we restore the session from the HttpOnly refresh cookie
    dispatch(restoreSession());
  }, [dispatch]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500" aria-busy="true">
        Loading…
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/tasks" element={<Navigate to="/tasks/all" replace />} />
            <Route path="/tasks/:view" element={<TasksPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </>
  );
}
