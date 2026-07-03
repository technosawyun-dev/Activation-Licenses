import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Notification from '../components/Notification';
import { formatDate, formatDateTime } from '../utils/format';

export default function TokenDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  usePageHeader('Activation Token');

  const load = () => api.get(`/api/admin/tokens/${id}`).then(setToken).catch(() => navigate('/tokens'));
  useEffect(() => { load(); }, [id]);

  const copy = (text, setFlag, ms) => {
    navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), ms);
  };

  const handleRevoke = async () => {
    if (!confirm('Revoke this token? The customer will no longer be able to use this activation link.')) return;
    try {
      await api.post(`/api/admin/tokens/${id}/revoke`);
      setSuccess('Token revoked');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleDeactivateLicense = async () => {
    if (!confirm('Deactivate this license? The customer will lose access.')) return;
    try {
      await api.post(`/api/admin/licenses/${token.license.id}/deactivate`);
      setSuccess('License deactivated');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (!token) return null;
  const activationUrl = token.activation_url;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link to="/tokens" className="text-on-surface-variant hover:text-primary transition-colors">Tokens</Link>
        <span className="msym text-outline" style={{ fontSize: 16 }}>chevron_right</span>
        <span className="text-on-surface font-mono text-xs">{token.license_number}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="label" style={{ margin: 0 }}>Token Details</h2>
              <span className={`badge badge-${token.status}`}>{token.status}</span>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Customer</dt>
                <dd className="font-semibold text-on-surface text-right">{token.customer_name}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Project</dt>
                <dd className="text-on-surface-variant text-right">{token.project_name}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">License #</dt>
                <dd className="font-mono text-xs text-on-surface-variant text-right">{token.license_number}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">License Type</dt>
                <dd className="text-on-surface-variant capitalize text-right">{token.license_type}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Created</dt>
                <dd className="text-xs text-outline text-right">{formatDateTime(token.created_at)}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <dt className="text-on-surface-variant flex-shrink-0">Link Expires</dt>
                <dd className="text-xs text-outline text-right">{token.expires_at ? formatDateTime(token.expires_at) : 'Never'}</dd>
              </div>
              {token.used_at && (
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Activated</dt>
                  <dd className="text-xs text-outline text-right">{formatDateTime(token.used_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          {token.status === 'pending' && (
            <div className="card p-5">
              <h2 className="label mb-3">Actions</h2>
              <button onClick={handleRevoke} className="btn-danger w-full justify-center">
                <span className="msym" style={{ fontSize: 16 }}>block</span>
                Revoke Token
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {token.status === 'pending' && (
            <div className="rounded-xl p-5" style={{ background: '#2563eb' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="msym" style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>link</span>
                <h2 className="text-sm font-semibold text-white">Send this link to the customer</h2>
              </div>
              <div className="font-mono text-xs break-all leading-relaxed select-all rounded-lg p-3 mb-3" style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.9)' }}>
                {activationUrl}
              </div>
              <button
                onClick={() => copy(activationUrl, setCopiedUrl, 2500)}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
              >
                <span className="msym" style={{ fontSize: 16 }}>{copiedUrl ? 'done' : 'content_copy'}</span>
                <span>{copiedUrl ? 'Copied!' : 'Copy Activation Link'}</span>
              </button>
              <p className="text-[11px] mt-2.5 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Customer clicks this → the desktop app opens and activates automatically.
              </p>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="label" style={{ margin: 0 }}>Raw Token</h2>
              <button onClick={() => copy(token.token, setCopiedToken, 2000)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <span className="msym" style={{ fontSize: 14 }}>{copiedToken ? 'done' : 'content_copy'}</span>
                <span>{copiedToken ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="font-mono text-[11px] text-on-surface-variant break-all leading-relaxed select-all p-3 rounded-lg" style={{ background: '#191c1e', border: '1px solid rgba(255,255,255,0.05)' }}>
              {token.token}
            </div>
          </div>

          {token.license && (
            <div className="card p-5">
              <h2 className="label mb-4">Activated License</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Computer ID</dt>
                  <dd className="font-mono text-xs text-on-surface-variant text-right">{token.license.computer_id}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Activated</dt>
                  <dd className="text-xs text-outline text-right">{formatDateTime(token.license.activated_at)}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <dt className="text-on-surface-variant flex-shrink-0">Status</dt>
                  <dd>
                    <span className={`badge ${token.license.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {token.license.is_active ? 'Active' : `Deactivated${token.license.deactivated_at ? ' · ' + formatDate(token.license.deactivated_at) : ''}`}
                    </span>
                  </dd>
                </div>
              </dl>
              {token.license.is_active && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button onClick={handleDeactivateLicense} className="btn-danger w-full justify-center">
                    Deactivate License
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
