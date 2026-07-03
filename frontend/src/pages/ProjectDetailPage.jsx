import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { usePageHeader } from '../context/PageHeaderContext';
import Modal from '../components/Modal';
import Notification from '../components/Notification';
import { formatDate, formatDateTime } from '../utils/format';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [success, setSuccess] = useState(location.state?.success || '');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [importKey, setImportKey] = useState('');
  const [modalError, setModalError] = useState('');

  usePageHeader(project?.name || '');

  const load = () => api.get(`/api/admin/projects/${id}`).then(setProject).catch(() => navigate('/projects'));
  useEffect(() => { load(); }, [id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(project.public_key_b64);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.patch(`/api/admin/projects/${id}`, editForm);
      setEditOpen(false);
      setSuccess('Project updated');
      load();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleImportKey = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await api.post(`/api/admin/projects/${id}/reimport-key`, { private_key: importKey });
      setImportOpen(false);
      setImportKey('');
      setSuccess('Key pair updated');
      load();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${project.name} and all its tokens? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/projects/${id}`);
      navigate('/projects', { state: { success: 'Project deleted' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (!project) return null;

  return (
    <div>
      <Notification type="success" message={success} onDismiss={() => setSuccess('')} />
      <Notification type="error" message={error} onDismiss={() => setError('')} />

      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link to="/projects" className="text-on-surface-variant hover:text-primary transition-colors">Projects</Link>
        <span className="msym text-outline" style={{ fontSize: 16 }}>chevron_right</span>
        <span className="text-on-surface font-medium">{project.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="label" style={{ margin: 0 }}>Project Details</h2>
              <button onClick={() => { setEditForm({ name: project.name, description: project.description || '', type: project.type || '', status: project.status || 'Development', version: project.version || '' }); setEditOpen(true); }} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
                <span className="msym" style={{ fontSize: 14 }}>edit</span> Edit
              </button>
            </div>
            <dl className="space-y-3">
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Name</dt>
                <dd className="font-semibold text-on-surface">{project.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Slug</dt>
                <dd className="font-mono text-xs text-on-surface-variant">{project.slug}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Deep Link Scheme</dt>
                <dd className="font-mono text-sm text-primary font-medium">{project.deep_link_scheme}://</dd>
              </div>
              {project.type && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Type</dt>
                  <dd><span className={`badge badge-${project.type.toLowerCase().replace(' ', '-')}`}>{project.type}</span></dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Status</dt>
                <dd><span className={`badge badge-${(project.status || 'development').toLowerCase()}`}>{project.status || 'Development'}</span></dd>
              </div>
              {project.version && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Version</dt>
                  <dd className="font-mono text-xs text-on-surface-variant">{project.version}</dd>
                </div>
              )}
              {project.description && (
                <div>
                  <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Description</dt>
                  <dd className="text-sm text-on-surface-variant">{project.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-mono text-outline uppercase mb-0.5">Created</dt>
                <dd className="text-xs text-outline">{formatDateTime(project.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="label" style={{ margin: 0 }}>Public Key</h2>
              <button onClick={handleCopy} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
                <span className="msym" style={{ fontSize: 14 }}>{copied ? 'done' : 'content_copy'}</span>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="font-mono text-[11px] text-on-surface-variant break-all leading-relaxed select-all p-3 rounded-lg" style={{ background: '#191c1e', border: '1px solid rgba(255,255,255,0.05)' }}>
              {project.public_key_b64}
            </div>
            <p className="text-[11px] text-outline mt-2">Hardcode this into your desktop app source.</p>
          </div>

          <div className="card p-5 space-y-2">
            <h2 className="label">Key Management</h2>
            <button onClick={() => setImportOpen(true)} className="btn-ghost w-full justify-start">
              <span className="msym" style={{ fontSize: 16 }}>upload</span>
              Import / Replace Key Pair
            </button>
            <button onClick={handleDelete} className="btn-danger w-full justify-start">
              <span className="msym" style={{ fontSize: 16 }}>delete</span>
              Delete Project
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-semibold text-on-surface">Tokens ({project.tokens.length})</h2>
              <Link to="/tokens" className="text-xs text-primary hover:underline">Generate token →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ background: '#191c1e', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <th className="th">Customer</th>
                    <th className="th">License #</th>
                    <th className="th">Status</th>
                    <th className="th">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tokens.length === 0 ? (
                    <tr><td colSpan={4} className="td text-center text-on-surface-variant text-sm py-8">No tokens for this project yet.</td></tr>
                  ) : project.tokens.map((t) => (
                    <tr key={t.id} className="hover:bg-[#272a2c] transition-colors border-b cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.04)' }} onClick={() => navigate(`/tokens/${t.id}`)}>
                      <td className="td font-medium text-on-surface">{t.customer_name}</td>
                      <td className="td font-mono text-xs text-on-surface-variant">{t.license_number}</td>
                      <td className="td"><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                      <td className="td text-xs text-outline whitespace-nowrap">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import / Replace Key Pair">
        {modalError && <Notification type="error" message={modalError} onDismiss={() => setModalError('')} />}
        <form onSubmit={handleImportKey} className="space-y-4">
          <div>
            <label className="label">Raw Base64 Private Key</label>
            <textarea required rows={3} placeholder="Paste the base64-encoded Ed25519 private key…" className="input font-mono text-xs" value={importKey} onChange={(e) => setImportKey(e.target.value)} />
            <div className="flex items-start gap-2 mt-2 p-3 rounded-lg" style={{ background: 'rgba(147,0,10,0.1)', border: '1px solid rgba(255,180,171,0.15)' }}>
              <span className="msym" style={{ fontSize: 16, color: '#ffb4ab', flexShrink: 0, marginTop: 1 }}>warning</span>
              <p className="text-xs" style={{ color: '#ffb4ab' }}>This replaces the current key pair. Existing licenses signed with the old key will stop validating.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setImportOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Import Key</button>
          </div>
        </form>
      </Modal>

      {editForm && (
        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Project">
          {modalError && <Notification type="error" message={modalError} onDismiss={() => setModalError('')} />}
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="label">Project Name</label>
              <input required className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="input" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                  <option value="">—</option>
                  <option value="SaaS">SaaS</option>
                  <option value="Desktop">Desktop</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Internal Tool">Internal Tool</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="Development">Development</option>
                  <option value="Beta">Beta</option>
                  <option value="Production">Production</option>
                  <option value="Deprecated">Deprecated</option>
                </select>
              </div>
              <div>
                <label className="label">Version</label>
                <input placeholder="1.0.0" className="input" value={editForm.version} onChange={(e) => setEditForm({ ...editForm, version: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea rows={2} className="input" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditOpen(false)} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
