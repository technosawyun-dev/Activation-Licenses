import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Modal from '../components/Modal';
import Notification from '../components/Notification';
import LoadError from '../components/LoadError';
import { formatDate } from '../utils/format';

const EMPTY_FORM = { project_id: '', customer_id: '', license_number: '', license_type: 'lifetime', expires_days: '' };

export default function TokensPage() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  const load = () => {
    setLoadError(false);
    api.get('/api/admin/tokens').then(setTokens).catch(() => setLoadError(true));
  };
  useEffect(() => {
    load();
    // Best-effort — only feed the create-token dropdowns; a failure here
    // shouldn't block the whole page, just leave those selects empty.
    api.get('/api/admin/projects').then(setProjects).catch(() => {});
    api.get('/api/admin/customers').then(setCustomers).catch(() => {});
  }, []);

  const headerActions = useMemo(() => (
    <button className="btn-primary" onClick={() => setOpen(true)}>
      <span className="msym" style={{ fontSize: 16 }}>add</span>
      Generate Token
    </button>
  ), []);
  usePageHeader('Activation Tokens', headerActions);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      const token = await api.post('/api/admin/tokens', { ...form, project_id: Number(form.project_id), customer_id: Number(form.customer_id) });
      setOpen(false);
      setForm(EMPTY_FORM);
      navigate(`/tokens/${token.id}`);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (loadError) return <LoadError onRetry={load} />;
  if (!tokens) return null;

  return (
    <div>
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">{tokens.length} token{tokens.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                <th className="th">License #</th>
                <th className="th">Customer</th>
                <th className="th">Project</th>
                <th className="th">Type</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th">Expires</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr><td colSpan={8} className="td text-center text-on-surface-variant text-sm py-10">
                  <div className="flex flex-col items-center gap-2">
                    <span className="msym text-outline" style={{ fontSize: 32 }}>key</span>
                    <p>No tokens generated yet</p>
                  </div>
                </td></tr>
              ) : tokens.map((t) => (
                <tr key={t.id} className="hover:bg-[#272a2c] transition-colors border-b cursor-pointer group" style={{ borderColor: 'rgba(255,255,255,0.04)' }} onClick={() => navigate(`/tokens/${t.id}`)}>
                  <td className="td font-mono text-xs text-on-surface-variant">{t.license_number}</td>
                  <td className="td font-semibold text-on-surface">{t.customer_name}</td>
                  <td className="td text-on-surface-variant text-sm">{t.project_name}</td>
                  <td className="td text-xs text-on-surface-variant capitalize">{t.license_type}</td>
                  <td className="td"><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                  <td className="td text-xs text-outline whitespace-nowrap">{formatDate(t.created_at)}</td>
                  <td className="td text-xs text-outline whitespace-nowrap">{t.expires_at ? formatDate(t.expires_at) : '—'}</td>
                  <td className="td text-right">
                    <span className="btn-ghost opacity-0 group-hover:opacity-100 transition-opacity inline-flex" style={{ padding: '4px 10px', fontSize: 12 }}>
                      <span className="msym" style={{ fontSize: 14 }}>open_in_new</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Generate Activation Token" maxWidth={520}>
        {modalError && <Notification type="error" message={modalError} onDismiss={() => setModalError('')} />}
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project</label>
              <select required className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Customer</label>
              <select required className="input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">License Number</label>
            <input required placeholder="e.g. SY-2025-001" className="input font-mono" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">License Type</label>
              <select className="input" value={form.license_type} onChange={(e) => setForm({ ...form, license_type: e.target.value })}>
                <option value="lifetime">Lifetime</option>
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="trial">Trial</option>
              </select>
            </div>
            <div>
              <label className="label">Link Expires (days)</label>
              <input type="number" min="1" placeholder="Leave blank = never" className="input" value={form.expires_days} onChange={(e) => setForm({ ...form, expires_days: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Generate Token</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
