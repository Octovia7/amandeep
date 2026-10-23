import { Calendar, Timer, User } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { openDrawer } from '../../features/ui/uiSlice';
import { fmtDate, fmtMinutes, isOverdue } from '../../utils/format';
import { PriorityBadge, SlaBadge, Tag } from '../common/Badges';

export default function TaskCard({ task }) {
  const dispatch = useDispatch();
  return (
    <button
      type="button"
      onClick={() => dispatch(openDrawer({ taskId: task.id }))}
      className="card block w-full space-y-2 p-3 text-left shadow-sm transition hover:border-indigo-300 dark:hover:border-indigo-700"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-sm font-medium ${task.status === 'Done' ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
        <PriorityBadge priority={task.priority} compact />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {task.dueAt && (
          <span className={`inline-flex items-center gap-1 ${isOverdue(task) ? 'font-medium text-red-600' : ''}`}>
            <Calendar size={12} /> {fmtDate(task.dueAt)}
          </span>
        )}
        {task.estimatedDurationMinutes != null && (
          <span className="inline-flex items-center gap-1">
            <Timer size={12} /> {fmtMinutes(task.estimatedDurationMinutes)}
          </span>
        )}
        {task.assignee && (
          <span className="inline-flex items-center gap-1">
            <User size={12} /> {task.assignee.name}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {task.slaStatus !== 'none' && <SlaBadge task={task} />}
        {task.tags?.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
    </button>
  );
}
