import { Info, LocateFixed, MapPinOff, X } from 'lucide-react';
import { formatCoords, formatSpeed } from '../utils/format.js';

const STATUS = {
  idle: ['Location is off. Lesgo only uses it after you allow it.', 'badge-neutral', 'Off'],
  locating: ['Finding your location…', 'badge-info', 'Locating'],
  active: ['Location available', 'badge-success', 'Active'],
  denied: ['Permission denied', 'badge-danger', 'Denied'],
  unavailable: ['Location unavailable', 'badge-warning', 'Unavailable'],
  timeout: ['Timed out', 'badge-warning', 'Timed out'],
  unsupported: ['Not supported in this browser', 'badge-neutral', 'Unsupported'],
};

const REALTIME = {
  live: ['badge-success', 'Live updates'],
  disabled: ['badge-neutral', 'Unavailable'],
  error: ['badge-warning', 'Reconnecting'],
  offline: ['badge-neutral', 'Offline'],
  connecting: ['badge-info', 'Connecting'],
};

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-navy-900 dark:text-white">{children}</dd>
    </div>
  );
}

// "Navigation information": GPS status, coordinates, speed, data sources,
// and controls to start or stop location access.
export default function LocationPanel({ geo, realtimeStatus, capabilities, onClose }) {
  const { status, position, tracking, error } = geo;
  const kmh = formatSpeed(position?.speed);
  const [statusText, statusBadge, statusShort] = STATUS[status] ?? STATUS.idle;
  const [rtBadge, rtText] = REALTIME[realtimeStatus] ?? REALTIME.connecting;

  return (
    <section
      aria-label="Navigation information"
      className="panel absolute right-2 bottom-[5.5rem] z-[950] w-[min(23rem,calc(100%-1rem))] animate-slide-up p-4 shadow-overlay sm:right-4 sm:bottom-24"
    >
      <div className="mb-1 flex items-center justify-between">
        <h2 className="section-title">Navigation information</h2>
        <button type="button" className="icon-btn -mr-2 h-8 w-8" onClick={onClose} aria-label="Close navigation information">
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="divide-y divide-slate-100 dark:divide-white/5">
        <Row label="GPS">
          <span className={statusBadge} title={statusText}>
            {statusShort}
          </span>
          <span className="sr-only">{statusText}</span>
        </Row>
        {position && (
          <>
            <Row label="Coordinates">
              <span className="font-mono text-[13px]">{formatCoords(position.lat, position.lng)}</span>
            </Row>
            <Row label="Accuracy">±{Math.round(position.accuracy)} m</Row>
            <Row label="Speed">{kmh !== null ? `${kmh} km/h` : 'Not available'}</Row>
          </>
        )}
        <Row label="Tracking">{tracking ? 'Following your movement' : 'Off'}</Row>
        <Row label="Community reports">
          <span className={rtBadge}>{rtText}</span>
        </Row>
      </dl>

      {error && <p className="alert-warning mt-3 text-[13px]">{error}</p>}

      <p className="alert-neutral mt-3 text-[13px]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span>
          {capabilities.traffic.available
            ? 'Road colours, official incidents (square markers) and travel times use live traffic data from TomTom. Round pins are community reports from drivers and are not verified.'
            : 'No live traffic data is connected. Routes use typical road speeds, and incident markers are unverified community reports.'}
        </span>
      </p>

      <div className="mt-3">
        {status !== 'active' ? (
          <button type="button" className="btn-primary w-full" onClick={geo.locate}>
            <LocateFixed className="h-4 w-4" aria-hidden /> Use my location
          </button>
        ) : (
          <button type="button" className="btn-secondary w-full" onClick={geo.clear}>
            <MapPinOff className="h-4 w-4" aria-hidden /> Stop using location
          </button>
        )}
      </div>
    </section>
  );
}
