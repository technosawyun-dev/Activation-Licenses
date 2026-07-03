import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHeaderValue } from '../context/PageHeaderContext';
import { api } from '../api/client';

const NAV_ITEMS = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/projects', icon: 'folder_managed', label: 'Projects' },
  { to: '/customers', icon: 'group', label: 'Customers' },
  { to: '/tokens', icon: 'key', label: 'Tokens' },
  { to: '/licenses', icon: 'assignment_turned_in', label: 'Licenses' },
  { to: '/devices', icon: 'devices', label: 'Devices' },
];

const SYSTEM_NAV_ITEMS = [
  { to: '/audit-logs', icon: 'history_edu', label: 'Audit Logs' },
  { to: '/users', icon: 'manage_accounts', label: 'Users' },
];

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      {({ isActive }) => (
        <>
          <span className={`msym ${isActive ? 'msym-fill' : ''}`}>{icon}</span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { title, actions } = useHeaderValue();

  const handleLogout = async () => {
    try { await api.post('/api/admin/logout'); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col h-screen bg-surface-container-low border-r border-outline-variant z-50">
        <div className="px-4 py-4 border-b border-outline-variant/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center flex-shrink-0">
              <span className="msym msym-fill text-[16px]" style={{ color: '#eeefff' }}>verified_user</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-on-surface leading-tight">Saw Yun LLC</h1>
              <p className="text-[10px] font-mono text-outline uppercase tracking-widest">License Activation</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => <NavItem key={item.to} {...item} />)}
          <div className="nav-section">System</div>
          {SYSTEM_NAV_ITEMS.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>

        <div className="px-2 py-3 border-t border-outline-variant/40">
          {user && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold" style={{ color: '#eeefff' }}>
                  {user.username[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate">{user.username}</p>
                <p className="text-[10px] font-mono text-outline uppercase">{user.role}</p>
              </div>
            </div>
          )}
          <a onClick={handleLogout} className="nav-item cursor-pointer" style={{ color: '#ffb4ab' }}>
            <span className="msym">logout</span>
            Logout
          </a>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-surface border-b border-outline-variant z-40">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-on-surface">{title}</span>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
