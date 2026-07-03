import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Notification from '../components/Notification';
import LoadError from '../components/LoadError';

function formatLastSeen(iso) {
  if (!iso) return '—';
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`;
  const d = new Date(normalized);
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).replace(',', ' ·');
}

export default function DevicesPage() {
  usePageHeader('Device Management');
  const [devices, setDevices] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoadError(false);
    api.get('/api/admin/devices').then(setDevices).catch(() => setLoadError(true));
  };
  useEffect(() => { load(); }, []);

  const handleBlock = async (d) => {
    if (!confirm('Block this device?')) return;
    try {
      await api.post(`/api/admin/devices/${d.id}/block`);
      setSuccess('Device blocked');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleUnblock = async (d) => {
    try {
      await api.post(`/api/admin/devices/${d.id}/unblock`);
      setSuccess('Device unblocked');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (loadError) return <LoadError onRetry={load} />;
  if (!devices) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">{devices.length} device{devices.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                <th className="th">Hostname</th>
                <th className="th">Fingerprint</th>
                <th className="th">OS</th>
                <th className="th">App Version</th>
                <th className="th">Customer</th>
                <th className="th">Last Seen</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr><td colSpan={8} className="td text-center text-on-surface-variant text-sm py-12">
                  <div className="flex flex-col items-center gap-2">
                    <span className="msym text-outline" style={{ fontSize: 32 }}>devices</span>
                    <p>No devices registered yet</p>
                    <p className="text-xs">Devices are automatically registered when a license is activated.</p>
                  </div>
                </td></tr>
              ) : devices.map((d) => (
                <tr key={d.id} className="hover:bg-[#272a2c] transition-colors border-b group" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <td className="td font-medium text-on-surface">{d.hostname || '—'}</td>
                  <td className="td font-mono text-xs text-on-surface-variant max-w-[160px] truncate" title={d.fingerprint}>{d.fingerprint}</td>
                  <td className="td text-sm text-on-surface-variant">{d.os || '—'}</td>
                  <td className="td font-mono text-xs text-on-surface-variant">{d.app_version || '—'}</td>
                  <td className="td text-sm text-on-surface-variant">{d.customer_name || '—'}</td>
                  <td className="td text-xs text-outline whitespace-nowrap">{formatLastSeen(d.last_seen)}</td>
                  <td className="td"><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.status !== 'blocked' ? (
                        <button onClick={() => handleBlock(d)} className="btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}>
                          <span className="msym" style={{ fontSize: 14 }}>block</span>
                        </button>
                      ) : (
                        <button onClick={() => handleUnblock(d)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
                          <span className="msym" style={{ fontSize: 14 }}>check_circle</span>
                        </button>
                      )}
                    </div>
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
