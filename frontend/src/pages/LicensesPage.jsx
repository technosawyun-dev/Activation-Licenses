import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Notification from '../components/Notification';
import LoadError from '../components/LoadError';
import { formatDate } from '../utils/format';

export default function LicensesPage() {
  usePageHeader('Activated Licenses');
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoadError(false);
    api.get('/api/admin/licenses').then(setLicenses).catch(() => setLoadError(true));
  };
  useEffect(() => { load(); }, []);

  const handleDeactivate = async (lic) => {
    if (!confirm(`Deactivate ${lic.customer_name}'s license?`)) return;
    try {
      await api.post(`/api/admin/licenses/${lic.id}/deactivate`);
      setSuccess('License deactivated');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (loadError) return <LoadError onRetry={load} />;
  if (!licenses) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">{licenses.length} license{licenses.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                <th className="th">Customer</th>
                <th className="th">Project</th>
                <th className="th">License #</th>
                <th className="th">Computer ID</th>
                <th className="th">Activated</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {licenses.length === 0 ? (
                <tr><td colSpan={7} className="td text-center text-on-surface-variant text-sm py-12">
                  <div className="flex flex-col items-center gap-2">
                    <span className="msym text-outline" style={{ fontSize: 32 }}>assignment_turned_in</span>
                    <p>No licenses activated yet</p>
                    <p className="text-xs">Licenses appear here once customers use activation links.</p>
                  </div>
                </td></tr>
              ) : licenses.map((l) => (
                <tr key={l.id} className="hover:bg-[#272a2c] transition-colors border-b cursor-pointer group" style={{ borderColor: 'rgba(255,255,255,0.04)' }} onClick={() => navigate(`/licenses/${l.id}`)}>
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
                  <td className="td font-mono text-xs text-outline max-w-[140px] truncate" title={l.computer_id}>{l.computer_id}</td>
                  <td className="td text-xs text-outline whitespace-nowrap">{formatDate(l.activated_at)}</td>
                  <td className="td">
                    {l.is_active ? (
                      <span className="badge badge-active">Active</span>
                    ) : (
                      <span className="badge badge-inactive">Inactive{l.deactivated_at ? ` · ${formatDate(l.deactivated_at)}` : ''}</span>
                    )}
                  </td>
                  <td className="td text-right">
                    {l.is_active ? (
                      <button onClick={(e) => { e.stopPropagation(); handleDeactivate(l); }} className="text-xs text-outline hover:text-error transition-colors font-mono opacity-0 group-hover:opacity-100">
                        Deactivate
                      </button>
                    ) : (
                      <span className="text-xs text-outline opacity-0 group-hover:opacity-50">—</span>
                    )}
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
