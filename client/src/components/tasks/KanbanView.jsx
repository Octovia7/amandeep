import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Settings2 } from 'lucide-react';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { listParam } from '../../hooks/useTaskFilters';
import { moveTask } from '../../features/tasks/tasksSlice';
import { openDrawer, pushToast } from '../../features/ui/uiSlice';
import { STATUSES } from '../../utils/format';
import TaskCard from './TaskCard';
import { ErrorState, Skeleton } from '../common/Feedback';

const HIDDEN_KEY = 'kanbanHiddenColumns';
const readHidden = () => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
  } catch {
    return [];
  }
};

function Column({ status, params, filteredOut }) {
  const dispatch = useDispatch();
  const { group, tasks, loadMore, retry } = useTaskGroup(`status:${status}`, { ...params, status }, !filteredOut);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-slate-100 dark:bg-slate-900/60">
      <header className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold">
          {status} <span className="ml-1 font-normal text-slate-500">{filteredOut ? 0 : group?.pagination?.totalItems ?? '…'}</span>
        </h3>
        <button className="btn-ghost px-1" aria-label={`Add task to ${status}`} onClick={() => dispatch(openDrawer({ defaults: { status } }))}>
          <Plus size={15} />
        </button>
      </header>
      <Droppable droppableId={status} isDropDisabled={filteredOut}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 ${snapshot.isDraggingOver ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}`}
            style={{ maxHeight: 'calc(100vh - 260px)' }}
          >
            {filteredOut ? (
              <p className="px-1 py-4 text-center text-xs text-slate-500">Hidden by status filter</p>
            ) : group?.status === 'error' ? (
              <ErrorState message={group.error} onRetry={retry} />
            ) : !group || (group.status === 'loading' && !group.pagination) ? (
              <>
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </>
            ) : (
              tasks.map((t, index) => (
                <Draggable key={t.id} draggableId={t.id} index={index}>
                  {(p) => (
                    <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                      <TaskCard task={t} />
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
            {group?.pagination?.hasNextPage && !filteredOut && (
              <button className="py-1 text-xs text-indigo-600 hover:underline" onClick={loadMore} disabled={group.status === 'loadingMore'}>
                {group.status === 'loadingMore' ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function KanbanView({ apiParams }) {
  const dispatch = useDispatch();
  const [hidden, setHidden] = useState(readHidden);
  const [configOpen, setConfigOpen] = useState(false);
  const { status, page, limit, ...params } = apiParams; // eslint-disable-line no-unused-vars
  const statusFilter = listParam(status);

  const toggleColumn = (s) => {
    const next = hidden.includes(s) ? hidden.filter((x) => x !== s) : [...hidden, s];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    const to = destination.droppableId;
    const res = await dispatch(moveTask({ id: draggableId, status: to, fromKey: `status:${source.droppableId}`, toKey: `status:${to}` }));
    if (res.error) dispatch(pushToast(`Could not move task: ${res.payload}. Change reverted.`, 'error'));
    else dispatch(pushToast(`Moved to ${to}`));
  };

  return (
    <div className="space-y-2">
      <div className="relative flex justify-end">
        <button className="btn-ghost text-xs" onClick={() => setConfigOpen((o) => !o)} aria-expanded={configOpen}>
          <Settings2 size={14} /> Columns
        </button>
        {configOpen && (
          <div className="card absolute right-0 top-full z-20 mt-1 w-48 space-y-1 p-3 shadow-lg" onMouseLeave={() => setConfigOpen(false)}>
            {STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!hidden.includes(s)} onChange={() => toggleColumn(s)} /> {s}
              </label>
            ))}
          </div>
        )}
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STATUSES.filter((s) => !hidden.includes(s)).map((s) => (
            <Column key={s} status={s} params={params} filteredOut={statusFilter.length > 0 && !statusFilter.includes(s)} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
