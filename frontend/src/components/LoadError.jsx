export default function LoadError({ onRetry }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <span className="msym" style={{ fontSize: 32, color: '#ffb4ab' }}>cloud_off</span>
      <p className="font-semibold text-on-surface mt-3 mb-1">Couldn't load this page</p>
      <p className="text-sm text-on-surface-variant mb-5">Check your connection and try again.</p>
      <button className="btn-ghost" onClick={onRetry}>Retry</button>
    </div>
  );
}
