import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Notification from '../components/Notification';
import { formatDateTime } from '../utils/format';

export default function LicenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [license, setLicense] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  usePageHeader('License Details');

  const load = () => api.get(`/api/admin/licenses/${id}`).then(setLicense).catch(() => navigate('/licenses'));
  useEffect(() => { load(); }, [id]);

  const handleDeactivate = async () => {
    if (!confirm(`Deactivate ${license.customer_name}'s license? The customer will lose access.`)) return;
    try {
      await api.post(`/api/admin/licenses/${id}/deactivate`);
      setSuccess('License deactivated');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (!license) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link to="/licenses" className="text-on-surface-variant hover:text-primary transition-colors">Licenses</Link>
        <span className="msym text-outline" style={{ fontSize: 16 }}>chevron_right</span>
        <span className="text-on-surface font-mono text-xs">{license.license_number}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="label" style={{ margin: 0 }}>License Details</h2>
              {license.is_active ? (
                <span className="badge badge-active">Active</span>
              ) : (
                <span className="badge badge-inactive">Inactive</span>
              )}
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Customer</dt>
                <dd className="font-semibold text-on-surface text-right">
                  <Link to={`/customers/${license.customer_id}`} className="hover:text-primary transition-colors">{license.customer_name}</Link>
                </dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Project</dt>
                <dd className="text-on-surface-variant text-right">{license.project_name}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">License #</dt>
                <dd className="font-mono text-xs text-on-surface-variant text-right">{license.license_number}</dd>
              </div>
              {license.license_type && (
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">License Type</dt>
                  <dd className="text-on-surface-variant capitalize text-right">{license.license_type}</dd>
                </div>
              )}
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Computer ID</dt>
                <dd className="font-mono text-xs text-on-surface-variant text-right break-all">{license.computer_id}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Activated</dt>
                <dd className="text-xs text-outline text-right">{formatDateTime(license.activated_at)}</dd>
              </div>
              {license.deactivated_at && (
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Deactivated</dt>
                  <dd className="text-xs text-outline text-right">{formatDateTime(license.deactivated_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="label mb-3">Related</h2>
            <button onClick={() => navigate(`/tokens/${license.token_id}`)} className="btn-ghost w-full justify-start">
              <span className="msym" style={{ fontSize: 16 }}>key</span>
              View Activation Token
            </button>
          </div>

          {license.is_active && (
            <div className="card p-5">
              <h2 className="label mb-3">Actions</h2>
              <button onClick={handleDeactivate} className="btn-danger w-full justify-center">
                <span className="msym" style={{ fontSize: 16 }}>block</span>
                Deactivate License
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="label mb-4">Device</h2>
            {license.device ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Hostname</dt>
                  <dd className="font-semibold text-on-surface text-right">{license.device.hostname || '—'}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">OS</dt>
                  <dd className="text-on-surface-variant text-right">{license.device.os || '—'}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">App Version</dt>
                  <dd className="font-mono text-xs text-on-surface-variant text-right">{license.device.app_version || '—'}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Last Seen</dt>
                  <dd className="text-xs text-outline text-right">{formatDateTime(license.device.last_seen)}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Access</dt>
                  <dd>
                    {license.device.status === 'blocked' ? (
                      <span className="badge badge-blocked">Blocked</span>
                    ) : (
                      <span className="badge badge-active">Allowed</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Last Active</dt>
                  <dd>
                    {license.device.is_online ? (
                      <span className="badge badge-online">Online</span>
                    ) : (
                      <span className="badge badge-inactive">Offline</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-on-surface-variant">No device information recorded for this license.</p>
            )}
            {license.device && (
              <button onClick={() => navigate(`/devices/${license.device.id}`)} className="btn-ghost w-full justify-center mt-4">
                View Device Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
