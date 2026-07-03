import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ConnectionErrorScreen({ onRetry }) {
  return (
    <div className="flex items-center justify-center h-screen" style={{ background: '#101415' }}>
      <div className="text-center max-w-sm">
        <span className="msym" style={{ fontSize: 40, color: '#ffb4ab' }}>cloud_off</span>
        <p className="font-semibold text-on-surface mt-3 mb-1">Can't reach the server</p>
        <p className="text-sm text-on-surface-variant mb-5">
          Your session may still be valid — this looks like a connection problem, not a login issue.
        </p>
        <button className="btn-primary" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, ready, connectionError, retry } = useAuth();
  if (!ready) return null;
  if (connectionError) return <ConnectionErrorScreen onRetry={retry} />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
