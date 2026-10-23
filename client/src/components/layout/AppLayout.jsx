import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard, UserCheck, ListTodo, CalendarDays, CalendarClock, AlertOctagon, CheckCircle2, FolderKanban,
  Settings, PanelLeftClose, PanelLeftOpen, Menu, Search, Bell, Sun, Moon, Monitor, LogOut, Plus,
} from 'lucide-react';
import { toggleSidebar, setMobileNav, setTheme, openDrawer } from '../../features/ui/uiSlice';
import { logout } from '../../features/auth/authSlice';
import { fetchSections } from '../../features/sections/sectionsSlice';
import { api } from '../../services/api';
import TaskDrawer from '../tasks/TaskDrawer';

const NAV = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/tasks/my', 'My Tasks', UserCheck],
  ['/tasks/all', 'All Tasks', ListTodo],
  ['/tasks/today', 'Today', CalendarDays],
  ['/tasks/upcoming', 'Upcoming', CalendarClock],
  ['/tasks/overdue', 'Overdue', AlertOctagon],
  ['/tasks/completed', 'Completed', CheckCircle2],
  ['/workspaces', 'Workspaces', FolderKanban],
  ['/settings', 'Settings', Settings],
];

function Sidebar() {
  const dispatch = useDispatch();
  const { sidebarCollapsed: collapsed, mobileNavOpen } = useSelector((s) => s.ui);
  const close = () => dispatch(setMobileNav(false));
  return (
    <>
      {mobileNavOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={close} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-60'} w-60`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {!collapsed && <span className="text-lg font-bold tracking-tight text-indigo-600">Taskflow</span>}
          <button className="btn-ghost hidden px-1.5 lg:inline-flex" onClick={() => dispatch(toggleSidebar())} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2" aria-label="Main">
          {NAV.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={close}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon size={17} aria-hidden />
              <span className={collapsed ? 'lg:sr-only' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    // Notifications = tasks that currently need attention (SLA at risk / breached, overdue)
    api
      .get('/tasks', { params: { sla: 'at_risk,breached', limit: 8, sortBy: 'sla', order: 'asc' } })
      .then((r) => setItems(r.data.data))
      .catch(() => setItems([]));
  }, [open]);
  return (
    <div className="relative">
      <button className="btn-ghost px-2" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-1 w-80 p-2 shadow-xl" onMouseLeave={() => setOpen(false)}>
          <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">Needs attention</p>
          {items === null ? (
            <p className="px-2 py-3 text-sm text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">You’re all caught up.</p>
          ) : (
            items.map((t) => (
              <button
                key={t.id}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  setOpen(false);
                  navigate(`/tasks/all?sla=${t.slaStatus}`);
                }}
              >
                <span className="block truncate font-medium">{t.title}</span>
                <span className={`text-xs ${t.slaStatus === 'breached' ? 'text-red-600' : 'text-amber-600'}`}>SLA {t.slaStatus.replace('_', ' ')}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Topbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const theme = useSelector((s) => s.ui.theme);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nextTheme = { light: 'dark', dark: 'system', system: 'light' }[theme];
  const ThemeIcon = { light: Sun, dark: Moon, system: Monitor }[theme];

  return (
    <header className="flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 sm:px-4">
      <button className="btn-ghost px-1.5 lg:hidden" onClick={() => dispatch(setMobileNav(true))} aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <form
        className="relative max-w-md flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/tasks/all?search=${encodeURIComponent(q)}`);
        }}
      >
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input ref={searchRef} className="input pl-8" placeholder="Search tasks…  ( / )" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Global search" />
      </form>
      <div className="ml-auto flex items-center gap-1">
        <button className="btn-primary" onClick={() => dispatch(openDrawer())}>
          <Plus size={16} /> <span className="hidden sm:inline">New task</span>
        </button>
        <Notifications />
        <button className="btn-ghost px-2" onClick={() => dispatch(setTheme(nextTheme))} aria-label={`Theme: ${theme}. Switch to ${nextTheme}`} title={`Theme: ${theme}`}>
          <ThemeIcon size={18} />
        </button>
        <button className="btn-ghost px-2" onClick={() => navigate('/settings')} aria-label="Settings">
          <Settings size={18} />
        </button>
        <div className="relative">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white"
            aria-label="Account menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            {user?.name?.[0]?.toUpperCase()}
          </button>
          {menu && (
            <div className="card absolute right-0 z-30 mt-1 w-56 py-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
              <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => dispatch(logout())}>
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function AppLayout() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchSections());
  }, [dispatch]);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
      <TaskDrawer />
    </div>
  );
}
