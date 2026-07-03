import { useEffect, useState } from 'react';

export default function Notification({ type, message, onDismiss }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(true);
    if (type === 'success') {
      const t = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(t);
    }
  }, [message, type]);

  if (!message || !show) return null;

  const isSuccess = type === 'success';
  return (
    <div className={isSuccess ? 'notif-success' : 'notif-error'}>
      <span className="msym" style={{ fontSize: 18, color: isSuccess ? '#34d399' : '#ffb4ab' }}>
        {isSuccess ? 'check_circle' : 'error'}
      </span>
      {message}
      <button
        onClick={() => { setShow(false); onDismiss?.(); }}
        className="ml-auto opacity-60 hover:opacity-100"
      >
        <span className="msym" style={{ fontSize: 16 }}>close</span>
      </button>
    </div>
  );
}
