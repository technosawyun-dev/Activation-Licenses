import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, maxWidth }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px 8px', border: 'none' }}>
            <span className="msym" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <div className="modal-body space-y-3">{children}</div>
      </div>
    </div>
  );
}
