import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Notification from '../components/Notification';
import { formatDateTime } from '../utils/format';

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  usePageHeader('Device Details');

  const load = () => api.get(`/api/admin/devices/${id}`).then(setDevice).catch(() => navigate('/devices'));
  useEffect(() => { load(); }, [id]);

  const handleBlock = async () => {
    if (!confirm('Block this device? It will no longer be able to use the license.')) return;
    try {
      await api.post(`/api/admin/devices/${id}/block`);
      setSuccess('Device blocked');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleUnblock = async () => {
    try {
      await api.post(`/api/admin/devices/${id}/unblock`);
      setSuccess('Device unblocked');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (!device) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link to="/devices" className="text-on-surface-variant hover:text-primary transition-colors">Devices</Link>
        <span className="msym text-outline" style={{ fontSize: 16 }}>chevron_right</span>
        <span className="text-on-surface font-medium">{device.hostname || device.fingerprint}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="label" style={{ margin: 0 }}>Device Details</h2>
              <div className="flex items-center gap-2">
                {device.status === 'blocked' ? (
                  <span className="badge badge-blocked">Blocked</span>
                ) : (
                  <span className="badge badge-active">Allowed</span>
                )}
                {device.is_online ? (
                  <span className="badge badge-online">Online</span>
                ) : (
                  <span className="badge badge-inactive">Offline</span>
                )}
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Hostname</dt>
                <dd className="font-semibold text-on-surface text-right">{device.hostname || '—'}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Fingerprint</dt>
                <dd className="font-mono text-xs text-on-surface-variant text-right break-all">{device.fingerprint}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">OS</dt>
                <dd className="text-on-surface-variant text-right">{device.os || '—'}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">App Version</dt>
                <dd className="font-mono text-xs text-on-surface-variant text-right">{device.app_version || '—'}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Customer</dt>
                <dd className="font-semibold text-on-surface text-right">
                  {device.customer_id ? (
                    <Link to={`/customers/${device.customer_id}`} className="hover:text-primary transition-colors">{device.customer_name}</Link>
                  ) : '—'}
                </dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Last Seen</dt>
                <dd className="text-xs text-outline text-right">{formatDateTime(device.last_seen)}</dd>
              </div>
              {device.blocked_at && (
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Blocked At</dt>
                  <dd className="text-xs text-outline text-right">{formatDateTime(device.blocked_at)}</dd>
                </div>
              )}
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Registered</dt>
                <dd className="text-xs text-outline text-right">{formatDateTime(device.created_at)}</dd>
              </div>
            </dl>
            <div className="mt-4 pt-4 border-t flex items-start gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="msym text-outline" style={{ fontSize: 15, marginTop: 1 }}>info</span>
              <p className="text-[11px] text-outline leading-relaxed">
                "Allowed" / "Blocked" is independent of the license's own status — deactivate the license too if you want
                to fully cut the customer off. "Online" means the app has checked in with the server at least once today;
                the app only checks in on launch (not continuously), so this isn't a live "currently running" indicator —
                use the exact "Last Seen" timestamp above to judge actual recency.
              </p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="label mb-3">Actions</h2>
            {device.status !== 'blocked' ? (
              <button onClick={handleBlock} className="btn-danger w-full justify-center">
                <span className="msym" style={{ fontSize: 16 }}>block</span>
                Block Device
              </button>
            ) : (
              <button onClick={handleUnblock} className="btn-ghost w-full justify-center">
                <span className="msym" style={{ fontSize: 16 }}>check_circle</span>
                Unblock Device
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="label mb-4">License</h2>
            {device.license ? (
              <>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between items-baseline gap-4">
                    <dt className="text-on-surface-variant flex-shrink-0">License #</dt>
                    <dd className="font-mono text-xs text-on-surface-variant text-right">{device.license.license_number}</dd>
                  </div>
                  <div className="flex justify-between items-baseline gap-4">
                    <dt className="text-on-surface-variant flex-shrink-0">Project</dt>
                    <dd className="text-on-surface-variant text-right">{device.license.project_name}</dd>
                  </div>
                  <div className="flex justify-between items-baseline gap-4">
                    <dt className="text-on-surface-variant flex-shrink-0">Status</dt>
                    <dd>
                      <span className={`badge ${device.license.is_active ? 'badge-active' : 'badge-inactive'}`}>
                        {device.license.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </dd>
                  </div>
                </dl>
                <button onClick={() => navigate(`/licenses/${device.license.id}`)} className="btn-ghost w-full justify-center mt-4">
                  View License Details
                </button>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">No license linked to this device.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
