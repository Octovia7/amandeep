import { useParams } from 'react-router-dom';
import { useTaskFilters } from '../hooks/useTaskFilters';
import FilterBar from '../components/filters/FilterBar';
import ListView from '../components/tasks/ListView';
import SectionView from '../components/tasks/SectionView';
import KanbanView from '../components/tasks/KanbanView';

const TITLES = {
  my: 'My Tasks',
  all: 'All Tasks',
  today: 'Today',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
  completed: 'Completed',
};

export default function TasksPage() {
  const { view = 'all' } = useParams();
  const { params, apiParams, setFilter, clearFilters, mode } = useTaskFilters(view);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{TITLES[view] || 'Tasks'}</h1>
      <FilterBar params={params} setFilter={setFilter} clearFilters={clearFilters} mode={mode} />
      {mode === 'kanban' ? (
        <KanbanView apiParams={apiParams} />
      ) : mode === 'section' ? (
        <SectionView apiParams={apiParams} />
      ) : (
        <ListView apiParams={apiParams} params={params} setFilter={setFilter} />
      )}
    </div>
  );
}
