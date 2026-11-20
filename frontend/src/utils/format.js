export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '–';
  if (meters < 1000) return `${Math.max(0, Math.round(meters / 10) * 10)} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '–';
  if (seconds < 60) return '<1 min';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatClock(date) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatEta(secondsFromNow, now = Date.now()) {
  if (!Number.isFinite(secondsFromNow)) return '–';
  return formatClock(new Date(now + secondsFromNow * 1000));
}

export function timeAgo(value, now = Date.now()) {
  const diff = Math.max(0, now - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function timeUntil(value, now = Date.now()) {
  const diff = new Date(value).getTime() - now;
  if (diff <= 0) return 'expired';
  const min = Math.ceil(diff / 60000);
  if (min < 60) return `in ${min} min`;
  return `in ${Math.round(min / 60)} h`;
}

export function formatSpeed(metersPerSecond) {
  if (!Number.isFinite(metersPerSecond) || metersPerSecond < 0) return null;
  return Math.round(metersPerSecond * 3.6);
}

export function formatCoords(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
