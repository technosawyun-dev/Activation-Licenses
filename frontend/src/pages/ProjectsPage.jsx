import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Modal from '../components/Modal';
import Notification from '../components/Notification';
import LoadError from '../components/LoadError';
import { formatDate } from '../utils/format';

const EMPTY_FORM = { name: '', slug: '', deep_link_scheme: '', type: '', status: 'Development', version: '', description: '', import_private_key: '' };

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoadError(false);
    api.get('/api/admin/projects').then(setProjects).catch(() => setLoadError(true));
  };
  useEffect(() => { load(); }, []);

  // Memoized so this element keeps a stable reference across re-renders —
  // usePageHeader depends on it, and a fresh JSX object every render would
  // trigger an infinite update loop (setHeader -> re-render -> new object -> ...).
  const headerActions = useMemo(() => (
    <button className="btn-primary" onClick={() => setOpen(true)}>
      <span className="msym" style={{ fontSize: 16 }}>add</span>
      New Project
    </button>
  ), []);
  usePageHeader('Software Projects', headerActions);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const project = await api.post('/api/admin/projects', form);
      setOpen(false);
      setForm(EMPTY_FORM);
      navigate(`/projects/${project.id}`, { state: { success: 'Project created' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) return <LoadError onRetry={load} />;
  if (!projects) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error && !open ? error : ''} onDismiss={() => setError('')} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
      </div>

      {projects.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <th className="th">Project</th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th">Version</th>
                  <th className="th">Tokens</th>
                  <th className="th">Licenses</th>
                  <th className="th">Created</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-[#272a2c] transition-colors border-b cursor-pointer group" style={{ borderColor: 'rgba(255,255,255,0.04)' }} onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: 'rgba(37,99,235,0.12)', color: '#b4c5ff' }}>
                          {p.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-on-surface">{p.name}</p>
                          <p className="text-xs text-outline font-mono">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      {p.type ? <span className={`badge badge-${p.type.toLowerCase().replace(' ', '-')}`}>{p.type}</span> : <span className="text-outline text-xs">—</span>}
                    </td>
                    <td className="td"><span className={`badge badge-${(p.status || 'development').toLowerCase()}`}>{p.status || 'Development'}</span></td>
                    <td className="td font-mono text-xs text-on-surface-variant">{p.version || '—'}</td>
                    <td className="td font-mono text-sm text-on-surface">{p.token_count}</td>
                    <td className="td font-mono text-sm text-on-surface">{p.license_count}</td>
                    <td className="td text-xs text-outline whitespace-nowrap">{formatDate(p.created_at)}</td>
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
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(37,99,235,0.1)' }}>
            <span className="msym text-primary" style={{ fontSize: 28 }}>folder_managed</span>
          </div>
          <p className="font-semibold text-on-surface mb-1">No projects yet</p>
          <p className="text-sm text-on-surface-variant mb-5">Create your first project to start issuing licenses.</p>
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <span className="msym" style={{ fontSize: 16 }}>add</span>
            Create Project
          </button>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Project">
        {error && <Notification type="error" message={error} onDismiss={() => setError('')} />}
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project Name</label>
              <input required placeholder="e.g. NexusPOS" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input required placeholder="e.g. nexuspos" className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Deep Link Scheme</label>
            <input required placeholder="e.g. nexuspos" className="input" value={form.deep_link_scheme} onChange={(e) => setForm({ ...form, deep_link_scheme: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="">Select…</option>
                <option value="SaaS">SaaS</option>
                <option value="Desktop">Desktop</option>
                <option value="Mobile">Mobile</option>
                <option value="Internal Tool">Internal Tool</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Development">Development</option>
                <option value="Beta">Beta</option>
                <option value="Production">Production</option>
                <option value="Deprecated">Deprecated</option>
              </select>
            </div>
            <div>
              <label className="label">Version</label>
              <input placeholder="e.g. 1.0.0" className="input" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} placeholder="Optional description…" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Import Private Key (optional)</label>
            <textarea rows={2} placeholder="Paste base64 Ed25519 private key, or leave blank to auto-generate…" className="input font-mono text-xs" value={form.import_private_key} onChange={(e) => setForm({ ...form, import_private_key: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-ghost flex-1" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>Create Project</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
