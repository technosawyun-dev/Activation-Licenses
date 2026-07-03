import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import LoadError from '../components/LoadError';

const ACTION_COLOR = {
  create: '#34d399', delete: '#ffb4ab', update: '#b4c5ff', deactivate: '#fbbf24',
  block: '#ffb4ab', unblock: '#34d399', reveal: '#fbbf24', rotate: '#a78bfa',
  revoke: '#ffb4ab', reset: '#fbbf24', login: '#4ade80',
};

function actionColor(action) {
  return ACTION_COLOR[action.split('_')[0]] || '#b4c5ff';
}

function formatTimestamp(iso) {
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`;
  const d = new Date(normalized);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' });
  return { date, time: `${time} UTC` };
}

const RESOURCES = ['Project', 'Customer', 'Token', 'License', 'Device', 'User'];

export default function AuditLogsPage() {
  usePageHeader('Audit Log');
  const [logs, setLogs] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState('');
  const [resource, setResource] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [appliedResource, setAppliedResource] = useState('');

  const load = (qq, rr) => {
    const params = new URLSearchParams();
    if (qq) params.set('q', qq);
    if (rr) params.set('resource', rr);
    setLoadError(false);
    api.get(`/api/admin/audit-logs?${params.toString()}`).then(setLogs).catch(() => setLoadError(true));
  };

  useEffect(() => { load('', ''); }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    setAppliedQ(q);
    setAppliedResource(resource);
    load(q, resource);
  };

  const handleClear = () => {
    setQ(''); setResource(''); setAppliedQ(''); setAppliedResource('');
    load('', '');
  };

  if (loadError) return <LoadError onRetry={() => load(appliedQ, appliedResource)} />;
  if (!logs) return null;

  return (
    <div>
      <form onSubmit={handleFilter} className="flex items-center gap-2 mb-4 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, resource…" className="input flex-1 min-w-0" style={{ maxWidth: 320 }} />
        <select value={resource} onChange={(e) => setResource(e.target.value)} className="input" style={{ width: 'auto' }}>
          <option value="">All resources</option>
          {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>Filter</button>
        {(appliedQ || appliedResource) && <button type="button" onClick={handleClear} className="btn-ghost">Clear</button>}
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                <th className="th">Timestamp</th>
                <th className="th">Actor</th>
                <th className="th">Action</th>
                <th className="th">Resource</th>
                <th className="th">Details</th>
                <th className="th">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="td text-center text-on-surface-variant text-sm py-12">
                  <div className="flex flex-col items-center gap-2">
                    <span className="msym text-outline" style={{ fontSize: 32 }}>history</span>
                    <p>No audit log entries yet</p>
                    <p className="text-xs">Every create, update, and delete action is recorded here.</p>
                  </div>
                </td></tr>
              ) : logs.map((log) => {
                const { date, time } = formatTimestamp(log.created_at);
                return (
                  <tr key={log.id} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="td text-xs text-outline whitespace-nowrap font-mono">
                      {date}<br /><span className="text-[10px]">{time}</span>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(37,99,235,0.2)', color: '#b4c5ff' }}>
                          {(log.actor_name || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-on-surface-variant">{log.actor_name || '—'}</span>
                      </div>
                    </td>
                    <td className="td">
                      <span className="font-mono text-xs font-semibold" style={{ color: actionColor(log.action) }}>{log.action}</span>
                    </td>
                    <td className="td">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-on-surface">{log.resource_type}</span>
                        {log.resource_name && <span className="text-[11px] text-outline truncate max-w-[140px]">{log.resource_name}</span>}
                      </div>
                    </td>
                    <td className="td text-xs text-on-surface-variant max-w-[220px] truncate">
                      {log.extra_data ? (log.extra_data.length > 80 ? `${log.extra_data.slice(0, 80)}…` : log.extra_data) : '—'}
                    </td>
                    <td className="td font-mono text-xs text-outline">{log.ip_address || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {logs.length >= 200 && (
          <div className="px-5 py-3 border-t text-xs text-outline text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            Showing last 200 entries. Newer entries at the top.
          </div>
        )}
      </div>
    </div>
  );
}
