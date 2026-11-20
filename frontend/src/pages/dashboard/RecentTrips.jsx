import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Navigation, Trash2 } from 'lucide-react';
import { clearHistory, deleteHistoryEntry, listHistory } from '../../services/accountService.js';
import { formatDate, formatDistance, formatDuration } from '../../utils/format.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { navigateHref } from './SavedPlaces.jsx';

export default function RecentTrips() {
  const { notify } = useToast();
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listHistory(30)
      .then(setHistory)
      .catch((err) => setError(err.message));
  }, []);

  const removeOne = async (id) => {
    try {
      await deleteHistoryEntry(id);
      setHistory((h) => h.filter((x) => x.id !== id));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const removeAll = async () => {
    try {
      await clearHistory();
      setHistory([]);
      notify('History cleared.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <section aria-labelledby="history-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="history-heading" className="text-lg font-semibold">
          Recent destinations
        </h2>
        {history?.length > 0 && (
          <button type="button" className="btn-secondary py-1.5 text-xs" onClick={removeAll}>
            Clear all
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500">Trips you started. Start points are stored at reduced precision.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      {history === null && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {history?.length === 0 && <p className="mt-4 text-sm text-slate-500">No trips yet.</p>}
      <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
        {history?.map((trip) => (
          <li key={trip.id} className="flex items-center gap-3 py-3">
            <Clock className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{trip.destination_label}</p>
              <p className="text-xs text-slate-500">
                {formatDate(trip.created_at)} · {formatDistance(trip.distance_meters)} · {formatDuration(trip.estimated_duration_seconds)}
              </p>
            </div>
            <Link
              to={navigateHref({ name: trip.destination_label, lat: trip.destination_latitude, lng: trip.destination_longitude })}
              className="icon-btn h-9 w-9"
              aria-label={`Navigate to ${trip.destination_label}`}
            >
              <Navigation className="h-4 w-4" />
            </Link>
            <button type="button" className="icon-btn h-9 w-9" onClick={() => removeOne(trip.id)} aria-label={`Remove ${trip.destination_label} from history`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
