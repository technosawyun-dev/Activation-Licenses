import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Modal from '../components/Modal';
import Notification from '../components/Notification';
import LoadError from '../components/LoadError';
import { formatDate } from '../utils/format';

const EMPTY_FORM = { name: '', company_name: '', email: '', phone: '', country: '', notes: '' };

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  const load = () => {
    setLoadError(false);
    api.get('/api/admin/customers').then(setCustomers).catch(() => setLoadError(true));
  };
  useEffect(() => { load(); }, []);

  const headerActions = useMemo(() => (
    <button className="btn-primary" onClick={() => setOpen(true)}>
      <span className="msym" style={{ fontSize: 16 }}>add</span>
      New Customer
    </button>
  ), []);
  usePageHeader('Customer Directory', headerActions);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.post('/api/admin/customers', form);
      setOpen(false);
      setForm(EMPTY_FORM);
      setSuccess('Customer added');
      load();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const openEdit = (c) => {
    setEditForm({ name: c.name, company_name: c.company_name || '', email: c.email || '', phone: c.phone || '', country: c.country || '', notes: c.notes || '', status: c.status || 'active' });
    setEditId(c.id);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.patch(`/api/admin/customers/${editId}`, editForm);
      setEditId(null);
      setSuccess('Customer updated');
      load();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await api.delete(`/api/admin/customers/${c.id}`);
      setSuccess('Customer deleted');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (loadError) return <LoadError onRetry={load} />;
  if (!customers) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
      </div>

      {customers.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <th className="th">Contact</th>
                  <th className="th">Company</th>
                  <th className="th">Email</th>
                  <th className="th">Country</th>
                  <th className="th">Status</th>
                  <th className="th">Licenses</th>
                  <th className="th">Created</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#272a2c] transition-colors border-b cursor-pointer group" style={{ borderColor: 'rgba(255,255,255,0.04)' }} onClick={() => navigate(`/customers/${c.id}`)}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: 'rgba(37,99,235,0.12)', color: '#b4c5ff' }}>
                          {c.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-on-surface">{c.name}</p>
                          {c.phone && <p className="text-xs text-outline">{c.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="td text-on-surface-variant text-sm">{c.company_name || '—'}</td>
                    <td className="td font-mono text-xs text-on-surface-variant">{c.email || '—'}</td>
                    <td className="td text-sm text-on-surface-variant">{c.country || '—'}</td>
                    <td className="td"><span className={`badge badge-${(c.status || 'active').toLowerCase()}`}>{c.status || 'active'}</span></td>
                    <td className="td font-mono text-sm text-on-surface">{c.license_count}</td>
                    <td className="td text-xs text-outline whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="td text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
                          <span className="msym" style={{ fontSize: 14 }}>edit</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(c); }} className="btn-danger" style={{ padding: '4px 8px', fontSize: 12, border: 'none' }}>
                          <span className="msym" style={{ fontSize: 14 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(190,198,224,0.1)' }}>
            <span className="msym" style={{ fontSize: 28, color: '#bec6e0' }}>group</span>
          </div>
          <p className="font-semibold text-on-surface mb-1">No customers yet</p>
          <p className="text-sm text-on-surface-variant mb-5">Add your first customer to assign licenses.</p>
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <span className="msym" style={{ fontSize: 16 }}>add</span>
            Add Customer
          </button>
        </div>
      )}

      <Modal open={editId !== null} onClose={() => setEditId(null)} title="Edit Customer">
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
            <button type="button" onClick={() => setEditId(null)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save Changes</button>
          </div>
        </form>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="New Customer">
        {modalError && open && <Notification type="error" message={modalError} onDismiss={() => setModalError('')} />}
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Name</label>
              <input required placeholder="e.g. Alex Mercer" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Company Name</label>
              <input placeholder="e.g. Gentek Systems" className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input type="email" placeholder="alex@gentek.com" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input placeholder="+95 9 xxx xxxx" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Country</label>
            <input placeholder="e.g. Myanmar" className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} placeholder="Optional notes…" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Add Customer</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
