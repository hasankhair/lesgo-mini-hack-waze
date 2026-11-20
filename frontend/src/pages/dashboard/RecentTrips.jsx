import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, MapPin, Navigation, Trash2 } from 'lucide-react';
import { clearHistory, deleteHistoryEntry, listHistory } from '../../services/accountService.js';
import { formatDate, formatDistance, formatDuration } from '../../utils/format.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { navigateHref } from './SavedPlaces.jsx';
import { Card, EmptyState, ErrorState, IconTile, ListSkeleton } from './ui.jsx';

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
    <Card
      title="Trips"
      description="Trips you started. Start points are stored at reduced precision."
      bodyClassName=""
      actions={
        history?.length > 0 && (
          <button type="button" className="btn-secondary btn-sm" onClick={removeAll}>
            Clear all
          </button>
        )
      }
    >
      {error && <ErrorState message={error} />}
      {history === null && !error && <ListSkeleton />}
      {history?.length === 0 && <EmptyState icon={History} title="No trips yet." text="Destinations you navigate to will appear here." />}
      {history?.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {history.map((trip) => (
            <li key={trip.id} className="list-row">
              <IconTile icon={MapPin} tone="navy" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900 dark:text-white">{trip.destination_label}</p>
                <p className="truncate text-[13px] text-slate-600 dark:text-slate-400">
                  {formatDate(trip.created_at)} · {formatDistance(trip.distance_meters)} · {formatDuration(trip.estimated_duration_seconds)}
                </p>
              </div>
              <Link
                to={navigateHref({ name: trip.destination_label, lat: trip.destination_latitude, lng: trip.destination_longitude })}
                className="btn-secondary btn-sm"
                aria-label={`Navigate to ${trip.destination_label}`}
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Go</span>
              </Link>
              <button
                type="button"
                className="icon-btn h-9 w-9 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                onClick={() => removeOne(trip.id)}
                aria-label={`Remove ${trip.destination_label} from history`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
