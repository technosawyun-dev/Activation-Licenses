import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Modal from '../components/Modal';
import Notification from '../components/Notification';
import { formatDate, formatDateTime } from '../utils/format';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState(null);
  const [success, setSuccess] = useState(location.state?.success || '');
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [modalError, setModalError] = useState('');

  usePageHeader(customer?.name || '');

  const load = () => api.get(`/api/admin/customers/${id}`).then(setCustomer).catch(() => navigate('/customers'));
  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    setEditForm({
      name: customer.name, company_name: customer.company_name || '', email: customer.email || '',
      phone: customer.phone || '', country: customer.country || '', notes: customer.notes || '',
      status: customer.status || 'active',
    });
    setEditOpen(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.patch(`/api/admin/customers/${id}`, editForm);
      setEditOpen(false);
      setSuccess('Customer updated');
      load();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/customers/${id}`);
      navigate('/customers', { state: { success: 'Customer deleted' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (!customer) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link to="/customers" className="text-on-surface-variant hover:text-primary transition-colors">Customers</Link>
        <span className="msym text-outline" style={{ fontSize: 16 }}>chevron_right</span>
        <span className="text-on-surface font-medium">{customer.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="label" style={{ margin: 0 }}>Customer Details</h2>
              <button onClick={openEdit} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
                <span className="msym" style={{ fontSize: 14 }}>edit</span> Edit
              </button>
            </div>
            <dl className="space-y-3">
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Contact Name</dt>
                <dd className="font-semibold text-on-surface">{customer.name}</dd>
              </div>
              {customer.company_name && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Company</dt>
                  <dd className="text-sm text-on-surface-variant">{customer.company_name}</dd>
                </div>
              )}
              {customer.email && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Email</dt>
                  <dd className="font-mono text-xs text-on-surface-variant">{customer.email}</dd>
                </div>
              )}
              {customer.phone && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Phone</dt>
                  <dd className="text-sm text-on-surface-variant">{customer.phone}</dd>
                </div>
              )}
              {customer.country && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Country</dt>
                  <dd className="text-sm text-on-surface-variant">{customer.country}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Status</dt>
                <dd><span className={`badge badge-${(customer.status || 'active').toLowerCase()}`}>{customer.status || 'active'}</span></dd>
              </div>
              {customer.notes && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Notes</dt>
                  <dd className="text-sm text-on-surface-variant whitespace-pre-wrap">{customer.notes}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Customer Since</dt>
                <dd className="text-xs text-outline">{formatDateTime(customer.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="card p-5 space-y-2">
            <h2 className="label">Danger Zone</h2>
            <button onClick={handleDelete} className="btn-danger w-full justify-start">
              <span className="msym" style={{ fontSize: 16 }}>delete</span>
              Delete Customer
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-semibold text-on-surface">Tokens &amp; Licenses ({customer.tokens.length})</h2>
              <Link to="/tokens" className="text-xs text-primary hover:underline">Generate token →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <th className="th">License #</th>
                    <th className="th">Project</th>
                    <th className="th">Token Status</th>
                    <th className="th">License</th>
                    <th className="th">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.tokens.length === 0 ? (
                    <tr><td colSpan={5} className="td text-center text-on-surface-variant text-sm py-8">No tokens for this customer yet.</td></tr>
                  ) : customer.tokens.map((t) => (
                    <tr key={t.id} className="hover:bg-[#272a2c] transition-colors border-b cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.04)' }} onClick={() => navigate(`/tokens/${t.id}`)}>
                      <td className="td font-mono text-xs text-on-surface-variant">{t.license_number}</td>
                      <td className="td text-on-surface-variant text-sm">{t.project_name}</td>
                      <td className="td"><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                      <td className="td">
                        {t.license_is_active === null ? (
                          <span className="text-xs text-outline">—</span>
                        ) : t.license_is_active ? (
                          <span className="badge badge-active">Active</span>
                        ) : (
                          <span className="badge badge-inactive">Inactive</span>
                        )}
                      </td>
                      <td className="td text-xs text-outline whitespace-nowrap">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-semibold text-on-surface">Devices ({customer.devices.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <th className="th">Hostname</th>
                    <th className="th">OS</th>
                    <th className="th">Last Seen</th>
                    <th className="th">Access / Online</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.devices.length === 0 ? (
                    <tr><td colSpan={4} className="td text-center text-on-surface-variant text-sm py-8">No devices registered yet.</td></tr>
                  ) : customer.devices.map((d) => (
                    <tr key={d.id} className="hover:bg-[#272a2c] transition-colors border-b cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.04)' }} onClick={() => navigate(`/devices/${d.id}`)}>
                      <td className="td font-medium text-on-surface">{d.hostname || '—'}</td>
                      <td className="td text-sm text-on-surface-variant">{d.os || '—'}</td>
                      <td className="td text-xs text-outline whitespace-nowrap">{formatDate(d.last_seen)}</td>
                      <td className="td">
                        <div className="flex items-center gap-1.5">
                          {d.status === 'blocked' ? (
                            <span className="badge badge-blocked">Blocked</span>
                          ) : (
                            <span className="badge badge-active">Allowed</span>
                          )}
                          {d.is_online ? (
                            <span className="badge badge-online">Online</span>
                          ) : (
                            <span className="badge badge-inactive">Offline</span>
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
      </div>

      {editForm && (
        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Customer">
          {modalError && <Notification type="error" message={modalError} onDismiss={() => setModalError('')} />}
          <form onSubmit={handleEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contact Name</label>
                <input required className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Company Name</label>
                <input className="input" value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Country</label>
                <input className="input" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea rows={2} className="input" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditOpen(false)} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
