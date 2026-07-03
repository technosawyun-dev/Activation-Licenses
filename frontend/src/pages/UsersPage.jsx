import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Notification from '../components/Notification';
import LoadError from '../components/LoadError';
import { formatDate } from '../utils/format';

const EMPTY_FORM = { username: '', email: '', password: '', role: 'ADMIN' };

export default function UsersPage() {
  const { user: me, isSuperOwner } = useAuth();
  const [users, setUsers] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [resetId, setResetId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newPassword, setNewPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  const load = () => {
    setLoadError(false);
    api.get('/api/admin/users').then(setUsers).catch(() => setLoadError(true));
  };
  useEffect(() => { load(); }, []);

  const headerActions = useMemo(() => (
    isSuperOwner ? (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <span className="msym" style={{ fontSize: 16 }}>person_add</span>
        Add User
      </button>
    ) : null
  ), [isSuperOwner]);
  usePageHeader('Admin Users', headerActions);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.post('/api/admin/users', form);
      setOpen(false);
      setForm(EMPTY_FORM);
      setSuccess('User created');
      load();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleRoleChange = async (u, role) => {
    try {
      await api.patch(`/api/admin/users/${u.id}/role`, { role });
      setSuccess('Role updated');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      load();
    }
  };

  const handleToggleStatus = async (u) => {
    try {
      await api.post(`/api/admin/users/${u.id}/toggle-status`);
      setSuccess('User status updated');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.post(`/api/admin/users/${resetId}/reset-password`, { new_password: newPassword });
      setResetId(null);
      setNewPassword('');
      setSuccess('Password reset');
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (loadError) return <LoadError onRetry={load} />;
  if (!users) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                <th className="th">User</th>
                <th className="th">Username</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} className="td text-center text-on-surface-variant text-sm py-12">No users found.</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-[#272a2c] transition-colors border-b group" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: 'rgba(37,99,235,0.15)', color: '#b4c5ff' }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-on-surface">{u.username}</p>
                        {u.email && <p className="text-xs text-outline">{u.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="td font-mono text-xs text-on-surface-variant">{u.username}</td>
                  <td className="td">
                    {isSuperOwner && u.role !== 'SUPER_OWNER' ? (
                      <select
                        value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="input" style={{ width: 'auto', padding: '4px 8px', fontSize: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_OWNER">SUPER_OWNER</option>
                      </select>
                    ) : (
                      <span className={`badge badge-${u.role === 'SUPER_OWNER' ? 'active' : 'inactive'}`}>{u.role}</span>
                    )}
                  </td>
                  <td className="td">
                    {isSuperOwner ? (
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`flex items-center gap-2 text-xs font-medium transition-colors ${u.status === 'active' ? 'text-emerald-400 hover:text-red-400' : 'text-red-400 hover:text-emerald-400'}`}
                      >
                        <span className={`w-2 h-2 rounded-full inline-block ${u.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        {u.status ? u.status[0].toUpperCase() + u.status.slice(1) : 'Active'}
                      </button>
                    ) : (
                      <span className="text-xs text-on-surface-variant">{u.status ? u.status[0].toUpperCase() + u.status.slice(1) : 'Active'}</span>
                    )}
                  </td>
                  <td className="td text-xs text-outline whitespace-nowrap">{u.created_at ? formatDate(u.created_at) : '—'}</td>
                  <td className="td text-right">
                    {isSuperOwner && (
                      <button onClick={() => setResetId(u.id)} className="btn-ghost opacity-0 group-hover:opacity-100 transition-opacity" style={{ padding: '4px 10px', fontSize: 12 }}>
                        <span className="msym" style={{ fontSize: 14 }}>key</span>
                        Reset Password
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-on-surface-variant">
        <span><strong className="text-on-surface">SUPER_OWNER</strong> — full access, incl. managing admin accounts; cannot be demoted</span>
        <span>·</span>
        <span><strong className="text-on-surface">ADMIN</strong> — full CRUD on projects/customers/tokens/licenses/devices; cannot manage other admin accounts</span>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Admin User" maxWidth={400}>
        {modalError && <Notification type="error" message={modalError} onDismiss={() => setModalError('')} />}
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label">Username</label>
            <input required placeholder="e.g. john_doe" className="input font-mono" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input type="email" placeholder="e.g. john@example.com" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required placeholder="Temporary password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_OWNER">SUPER_OWNER</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Create User</button>
          </div>
        </form>
      </Modal>

      <Modal open={resetId !== null} onClose={() => setResetId(null)} title="Reset Password" maxWidth={380}>
        {modalError && <Notification type="error" message={modalError} onDismiss={() => setModalError('')} />}
        <form onSubmit={handleResetPassword} className="space-y-3">
          <div>
            <label className="label">New Password</label>
            <input type="password" required placeholder="Enter new password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setResetId(null)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Reset Password</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
