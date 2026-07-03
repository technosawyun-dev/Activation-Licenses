// All timestamps from the API are naive UTC ISO strings (no "Z" suffix) — treat
// them as UTC explicitly rather than relying on the browser to guess.
function asUtcDate(iso) {
  if (!iso) return null;
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`;
  return new Date(normalized);
}

export function formatDate(iso) {
  const d = asUtcDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(iso) {
  const d = asUtcDate(iso);
  if (!d) return '—';
  return `${formatDate(iso)} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC`;
}
