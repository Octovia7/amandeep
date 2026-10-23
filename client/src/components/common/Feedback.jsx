import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCircle, CheckCircle2, Inbox, X } from 'lucide-react';
import { dismissToast } from '../../features/ui/uiSlice';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

export function SkeletonRows({ rows = 6 }) {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <Inbox className="text-slate-400" size={32} aria-hidden />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <AlertCircle className="text-red-500" size={28} aria-hidden />
      <p className="text-sm text-red-600 dark:text-red-400">{message || 'Failed to load'}</p>
      {onRetry && (
        <button className="btn-outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel?.();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="card w-full max-w-sm p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button ref={ref} className="btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  const dispatch = useDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), 4000);
    return () => clearTimeout(t);
  }, [dispatch, toast.id]);
  const error = toast.type === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`card flex items-start gap-2 px-3 py-2.5 text-sm shadow-lg ${error ? 'border-red-300 dark:border-red-800' : ''}`}
    >
      {error ? <AlertCircle size={16} className="mt-0.5 text-red-500" /> : <CheckCircle2 size={16} className="mt-0.5 text-emerald-500" />}
      <span className="flex-1">{toast.message}</span>
      <button aria-label="Dismiss" className="text-slate-400 hover:text-slate-600" onClick={() => dispatch(dismissToast(toast.id))}>
        <X size={14} />
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useSelector((s) => s.ui.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}
