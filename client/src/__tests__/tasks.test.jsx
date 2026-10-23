import { configureStore } from '@reduxjs/toolkit';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import tasks, { moveTask } from '../features/tasks/tasksSlice';
import ui from '../features/ui/uiSlice';
import { validateTask } from '../components/tasks/TaskDrawer';
import { passwordError } from '../pages/AuthPages';
import Pagination from '../components/pagination/Pagination';
import { SlaBadge } from '../components/common/Badges';

describe('validateTask', () => {
  const base = { title: 'x', estimatedDurationMinutes: '', actualDurationMinutes: '', timeSpentMinutes: '', slaDurationMinutes: '', startAt: '', dueAt: '' };
  it('requires a title', () => expect(validateTask({ ...base, title: '  ' }).title).toBeTruthy());
  it('rejects negative durations', () => expect(validateTask({ ...base, estimatedDurationMinutes: '-1' }).estimatedDurationMinutes).toBeTruthy());
  it('rejects due before start', () =>
    expect(validateTask({ ...base, startAt: '2026-01-02T10:00', dueAt: '2026-01-01T10:00' }).dueAt).toBeTruthy());
  it('accepts a valid task', () => expect(validateTask(base)).toEqual({}));
});

describe('passwordError', () => {
  it('enforces length and composition', () => {
    expect(passwordError('short1')).toBeTruthy();
    expect(passwordError('longpassword')).toBeTruthy();
    expect(passwordError('Password123')).toBeNull();
  });
});

describe('Kanban optimistic move', () => {
  const setup = () => {
    const store = configureStore({ reducer: { tasks, ui } });
    store.dispatch({
      type: 'tasks/fetchGroup/fulfilled',
      payload: { key: 'status:To Do', data: [{ id: 'a', status: 'To Do' }], pagination: {} },
    });
    store.dispatch({ type: 'tasks/fetchGroup/fulfilled', payload: { key: 'status:Done', data: [], pagination: {} } });
    return store;
  };
  const arg = { id: 'a', status: 'Done', fromKey: 'status:To Do', toKey: 'status:Done' };

  it('moves the card immediately and rolls back on failure', () => {
    const store = setup();
    store.dispatch({ type: moveTask.pending.type, meta: { arg } });
    expect(store.getState().tasks.groups['status:Done'].ids).toEqual(['a']);
    expect(store.getState().tasks.entities.a.status).toBe('Done');
    store.dispatch({ type: moveTask.rejected.type, meta: { arg }, payload: 'fail' });
    expect(store.getState().tasks.groups['status:To Do'].ids).toEqual(['a']);
    expect(store.getState().tasks.groups['status:Done'].ids).toEqual([]);
    expect(store.getState().tasks.entities.a.status).toBe('To Do');
  });

  it('keeps the move and bumps version on success', () => {
    const store = setup();
    store.dispatch({ type: moveTask.pending.type, meta: { arg } });
    store.dispatch({ type: moveTask.fulfilled.type, meta: { arg }, payload: { id: 'a', status: 'Done' } });
    expect(store.getState().tasks.entities.a.status).toBe('Done');
    expect(store.getState().tasks.version).toBe(1);
  });
});

describe('components', () => {
  it('Pagination navigates and disables prev on first page', () => {
    const onPage = vi.fn();
    render(
      <Pagination
        pagination={{ page: 1, limit: 10, totalItems: 35, totalPages: 4, hasNextPage: true, hasPreviousPage: false }}
        onPage={onPage}
        onLimit={() => {}}
      />
    );
    expect(screen.getByLabelText('Previous page').disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByText('1–10 of 35')).toBeTruthy();
  });

  it('SlaBadge shows remaining time and overdue duration', () => {
    const { rerender } = render(<SlaBadge task={{ slaStatus: 'at_risk', sla: { remainingMinutes: 15 } }} />);
    expect(screen.getByText(/At Risk/)).toBeTruthy();
    expect(screen.getByText(/15m left/)).toBeTruthy();
    rerender(<SlaBadge task={{ slaStatus: 'breached', sla: { overdueMinutes: 90 } }} />);
    expect(screen.getByText(/\+1h 30m/)).toBeTruthy();
  });
});
