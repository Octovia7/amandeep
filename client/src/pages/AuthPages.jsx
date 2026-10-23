import { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, register } from '../features/auth/authSlice';
import { api, errorMessage } from '../services/api';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const passwordError = (p) =>
  p.length < 8 ? 'At least 8 characters' : !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'Include a letter and a number' : null;

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-2xl font-bold tracking-tight text-indigo-600">Taskflow</p>
        <div className="card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>}
      </div>
    </div>
  );
}

function Input({ label, error, ...props }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" aria-invalid={!!error} {...props} />
      {error && <span className="mt-0.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const Alert = ({ children, tone = 'error' }) =>
  children ? (
    <p role="alert" className={`rounded-md px-3 py-2 text-sm ${tone === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
      {children}
    </p>
  ) : null;

export function LoginPage() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user, status, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RX.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    if (!Object.keys(errs).length) dispatch(login(form));
  };

  return (
    <Shell title="Log in" subtitle="Welcome back." footer={<>No account? <Link className="text-indigo-600 hover:underline" to="/register">Sign up</Link></>}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Alert>{error}</Alert>
        <Input label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" type="password" autoComplete="current-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <div className="text-right">
          <Link to="/forgot-password" className="text-xs text-indigo-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <button className="btn-primary w-full" disabled={status === 'loading'}>
          {status === 'loading' ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const dispatch = useDispatch();
  const { user, status, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  if (user) return <Navigate to="/" replace />;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!EMAIL_RX.test(form.email)) errs.email = 'Enter a valid email';
    const pe = passwordError(form.password);
    if (pe) errs.password = pe;
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (!Object.keys(errs).length) dispatch(register({ name: form.name, email: form.email, password: form.password }));
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Shell title="Create your account" footer={<>Already have an account? <Link className="text-indigo-600 hover:underline" to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Alert>{error}</Alert>
        <Input label="Name" autoComplete="name" value={form.name} error={errors.name} onChange={set('name')} />
        <Input label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={set('email')} />
        <Input label="Password" type="password" autoComplete="new-password" value={form.password} error={errors.password} onChange={set('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} error={errors.confirm} onChange={set('confirm')} />
        <button className="btn-primary w-full" disabled={status === 'loading'}>
          {status === 'loading' ? 'Creating…' : 'Sign up'}
        </button>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ loading: false, message: null, error: null, devToken: null });

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RX.test(email)) return setState({ ...state, error: 'Enter a valid email' });
    setState({ loading: true });
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setState({ loading: false, message: data.data.message, devToken: data.data.devResetToken });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  };

  return (
    <Shell title="Reset your password" subtitle="We’ll send you a reset link." footer={<Link className="text-indigo-600 hover:underline" to="/login">Back to login</Link>}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Alert>{state.error}</Alert>
        <Alert tone="success">{state.message}</Alert>
        {state.devToken && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Development mode (no email provider):{' '}
            <Link className="font-medium underline" to={`/reset-password?token=${state.devToken}`}>
              open reset link
            </Link>
          </p>
        )}
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn-primary w-full" disabled={state.loading}>
          {state.loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [state, setState] = useState({ loading: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    const pe = passwordError(password);
    if (pe) return setState({ error: pe });
    setState({ loading: true });
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password });
      navigate('/login', { replace: true });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  };

  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Alert>{state.error}</Alert>
        <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary w-full" disabled={state.loading || !params.get('token')}>
          {state.loading ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </Shell>
  );
}
