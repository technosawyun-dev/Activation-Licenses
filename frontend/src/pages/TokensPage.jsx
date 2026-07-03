import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Modal from '../components/Modal';
import Notification from '../components/Notification';
import LoadError from '../components/LoadError';
import { formatDate } from '../utils/format';

const EMPTY_FORM = { project_id: '', customer_id: '', license_number: '', license_type: 'lifetime', expires_days: '' };

// Preset license types map to a standard validity window; anything else
// (a custom label, or a plain number of days typed directly into the
// License Type field) is left for the admin to interpret themselves.
const LICENSE_TYPE_DAYS = { lifetime: '', annual: '365', monthly: '30', trial: '14' };

function generateLicenseNumber(project, existingTokens) {
  if (!project) return '';
  const prefix = (project.slug || project.name || 'LIC')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'LIC';
  const year = new Date().getFullYear();
  const seq = existingTokens.filter((t) => String(t.project_id) === String(project.id)).length + 1;
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
}

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

  const handleProjectChange = (e) => {
    const project_id = e.target.value;
    const project = projects.find((p) => String(p.id) === project_id);
    setForm((f) => ({ ...f, project_id, license_number: generateLicenseNumber(project, tokens || []) }));
  };

  // The <select> shows "Custom" whenever the stored license_type isn't one of
  // the known presets (i.e. it's a raw day count typed in via the Custom field).
  const isPresetType = form.license_type.toLowerCase() in LICENSE_TYPE_DAYS;
  const licenseTypeSelectValue = isPresetType ? form.license_type.toLowerCase() : 'custom';

  const handleLicenseTypeSelect = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      // Custom reuses the existing Link Expires (days) field as the day count
      // instead of adding a second box — just seed license_type from whatever's there.
      setForm((f) => ({ ...f, license_type: f.license_type.toLowerCase() in LICENSE_TYPE_DAYS ? f.expires_days : f.license_type }));
    } else {
      setForm((f) => ({ ...f, license_type: val, expires_days: LICENSE_TYPE_DAYS[val] }));
    }
  };

  const handleExpiresDaysChange = (e) => {
    const days = e.target.value;
    // In Custom mode the day count IS the license type, so keep them in sync.
    setForm((f) => (licenseTypeSelectValue === 'custom' ? { ...f, expires_days: days, license_type: days } : { ...f, expires_days: days }));
  };

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
              <select required className="input" value={form.project_id} onChange={handleProjectChange}>
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
            <input required readOnly placeholder="Select a project to generate" className="input font-mono" style={{ opacity: form.license_number ? 1 : 0.6, cursor: 'default' }} value={form.license_number} />
            <p className="text-[11px] text-outline mt-1">Auto-generated from the project, e.g. PROJECT-2026-001</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">License Type</label>
              <select className="input" value={licenseTypeSelectValue} onChange={handleLicenseTypeSelect}>
                <option value="lifetime">Lifetime</option>
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="trial">Trial</option>
                <option value="custom">Custom (days)…</option>
              </select>
            </div>
            <div>
              <label className="label">Link Expires (days)</label>
              <input type="number" min="1" placeholder="Leave blank = never" className="input" value={form.expires_days} onChange={handleExpiresDaysChange} />
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
