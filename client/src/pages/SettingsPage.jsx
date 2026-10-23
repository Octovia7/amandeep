import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, errorMessage } from '../services/api';
import { setTheme, pushToast } from '../features/ui/uiSlice';
import { tokenRefreshed } from '../features/auth/authSlice';
import { passwordError } from './AuthPages';
import { ErrorState, SkeletonRows } from '../components/common/Feedback';

export function SettingsPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const theme = useSelector((s) => s.ui.theme);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const pe = passwordError(form.newPassword);
    if (!form.currentPassword) return setError('Current password is required');
    if (pe) return setError(pe);
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/change-password', form);
      dispatch(tokenRefreshed({ accessToken: data.data.accessToken }));
      dispatch(pushToast('Password changed'));
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <section className="card space-y-1 p-4">
        <h2 className="font-semibold">Profile</h2>
        <p className="text-sm">{user?.name}</p>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </section>
      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Appearance</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="Theme">
          {['light', 'dark', 'system'].map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? 'btn-primary' : 'btn-outline'} onClick={() => dispatch(setTheme(t))}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Change password</h2>
        <form onSubmit={submit} className="space-y-3" noValidate>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <label className="block">
            <span className="label">Current password</span>
            <input type="password" className="input" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">New password</span>
            <input type="password" className="input" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </label>
          <button className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}

export function WorkspacesPage() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const load = () =>
    api
      .get('/workspaces')
      .then((r) => setList(r.data.data))
      .catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    load();
  }, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!list) return <SkeletonRows rows={3} />;
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Workspaces</h1>
      {list.map((w) => (
        <section key={w._id} className="card p-4">
          <h2 className="font-semibold">{w.name}</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {w.members.map((m) => (
              <li key={m.user._id} className="flex justify-between py-1.5">
                <span>
                  {m.user.name} <span className="text-slate-500">· {m.user.email}</span>
                </span>
                <span className="chip bg-slate-100 dark:bg-slate-800">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
