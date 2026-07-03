import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import LoadError from '../components/LoadError';
import { formatDate, formatDateTime } from '../utils/format';

const ACTION_ICON = (action) => {
  if (action.includes('login') || action.includes('logout')) return 'person';
  if (action.includes('project')) return 'folder_managed';
  if (action.includes('customer')) return 'group';
  if (action.includes('token')) return 'key';
  if (action.includes('license')) return 'assignment_turned_in';
  if (action.includes('device')) return 'devices';
  return 'history_edu';
};

function StatCard({ to, icon, iconColor, iconBg, label, value, sublabel }) {
  return (
    <Link to={to} className="stat-card group hover:border-primary/30 transition-colors" style={{ textDecoration: 'none', cursor: 'pointer' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
          <span className="msym" style={{ fontSize: 18, color: iconColor }}>{icon}</span>
        </div>
        <span className="text-[10px] font-mono text-outline uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-on-surface">{value}</p>
      <p className="text-xs text-on-surface-variant mt-0.5">{sublabel}</p>
    </Link>
  );
}

export default function DashboardPage() {
  usePageHeader('Control Center Overview');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    api.get('/api/admin/dashboard').then(setData).catch(() => setLoadError(true));
  };
  useEffect(() => { load(); }, []);

  if (loadError) return <LoadError onRetry={load} />;
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard to="/projects" icon="folder_managed" iconColor="#b4c5ff" iconBg="rgba(37,99,235,0.15)" label="Projects" value={data.total_projects} sublabel="Software products" />
        <StatCard to="/customers" icon="group" iconColor="#bec6e0" iconBg="rgba(190,198,224,0.12)" label="Customers" value={data.total_customers} sublabel="Registered accounts" />
        <StatCard to="/licenses" icon="assignment_turned_in" iconColor="#34d399" iconBg="rgba(52,211,153,0.1)" label="Licenses" value={data.active_licenses} sublabel="Active activations" />
        <StatCard to="/devices" icon="devices" iconColor="#b7c8e1" iconBg="rgba(183,200,225,0.1)" label="Devices" value={data.total_devices} sublabel="Registered machines" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/tokens" className="stat-card flex items-center gap-4 hover:border-primary/20 transition-colors" style={{ textDecoration: 'none', cursor: 'pointer', padding: '14px 20px' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <span className="msym" style={{ fontSize: 18, color: '#fbbf24' }}>key</span>
          </div>
          <div>
            <p className="text-xl font-bold text-on-surface">{data.pending_tokens}</p>
            <p className="text-xs text-on-surface-variant">Pending tokens</p>
          </div>
        </Link>
        <Link to="/audit-logs" className="stat-card flex items-center gap-4 hover:border-primary/20 transition-colors" style={{ textDecoration: 'none', cursor: 'pointer', padding: '14px 20px' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(180,197,255,0.1)' }}>
            <span className="msym text-primary" style={{ fontSize: 18 }}>history_edu</span>
          </div>
          <div>
            <p className="text-xl font-bold text-on-surface">{data.recent_audit.length}</p>
            <p className="text-xs text-on-surface-variant">Recent audit events</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-semibold text-on-surface">Recent Tokens</h3>
            <Link to="/tokens" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                <th className="th">License #</th>
                <th className="th">Customer</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_tokens.length === 0 ? (
                <tr><td colSpan={3} className="td text-center text-on-surface-variant text-sm py-8">No tokens yet</td></tr>
              ) : data.recent_tokens.map((t) => (
                <tr key={t.id} className="hover:bg-[#272a2c] transition-colors cursor-pointer" onClick={() => window.location.assign(`/tokens/${t.id}`)}>
                  <td className="td font-mono text-xs text-on-surface-variant">{t.license_number}</td>
                  <td className="td text-sm text-on-surface">{t.customer_name}</td>
                  <td className="td"><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-semibold text-on-surface">Recent Activity</h3>
            <Link to="/audit-logs" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {data.recent_audit.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-on-surface-variant">No activity yet</div>
            ) : data.recent_audit.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(180,197,255,0.15)' }}>
                  <span className="msym text-primary" style={{ fontSize: 14 }}>{ACTION_ICON(log.action)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">
                    <span className="font-semibold">{log.actor_name}</span>
                    <span className="text-on-surface-variant"> · {log.action.replace(/_/g, ' ')}</span>
                    {log.resource_name && <span className="text-primary"> {log.resource_name.slice(0, 24)}</span>}
                  </p>
                  <p className="text-[11px] text-outline font-mono mt-0.5">{formatDateTime(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-semibold text-on-surface">Recent License Activations</h3>
          <Link to="/licenses" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                <th className="th">Customer</th>
                <th className="th">Project</th>
                <th className="th">License #</th>
                <th className="th">Activated</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_licenses.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-on-surface-variant text-sm py-8">No licenses activated yet</td></tr>
              ) : data.recent_licenses.map((l) => (
                <tr key={l.id} className="hover:bg-[#272a2c] transition-colors border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold" style={{ background: 'rgba(37,99,235,0.12)', color: '#b4c5ff' }}>
                        {l.customer_name[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-on-surface">{l.customer_name}</span>
                    </div>
                  </td>
                  <td className="td text-on-surface-variant text-sm">{l.project_name}</td>
                  <td className="td font-mono text-xs text-on-surface-variant">{l.license_number}</td>
                  <td className="td text-xs text-outline whitespace-nowrap">{formatDate(l.activated_at)}</td>
                  <td className="td">
                    <span className={`badge ${l.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {l.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
