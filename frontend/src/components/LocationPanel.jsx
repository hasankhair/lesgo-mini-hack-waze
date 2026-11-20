import { Info, LocateFixed, MapPinOff, Radio, X } from 'lucide-react';
import { formatCoords, formatSpeed } from '../utils/format.js';

const STATUS_TEXT = {
  idle: 'Location is off. Lesgo only uses it after you allow it.',
  locating: 'Finding your location…',
  active: 'Location available',
  denied: 'Permission denied',
  unavailable: 'Location unavailable',
  timeout: 'Timed out',
  unsupported: 'Not supported in this browser',
};

// "Navigation information": GPS status, coordinates, speed, data sources,
// and controls to start or stop location access.
export default function LocationPanel({ geo, realtimeStatus, capabilities, onClose }) {
  const { status, position, tracking, error } = geo;
  const kmh = formatSpeed(position?.speed);

  return (
    <section aria-label="Navigation information" className="panel absolute right-2 bottom-24 z-[950] w-[min(22rem,calc(100%-1rem))] animate-slide-up p-4 sm:right-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Navigation information</h2>
        <button type="button" className="icon-btn -mr-2 h-8 w-8" onClick={onClose} aria-label="Close navigation information">
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">GPS</dt>
          <dd className="text-right font-medium">{STATUS_TEXT[status]}</dd>
        </div>
        {position && (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Coordinates</dt>
              <dd className="font-mono text-xs">{formatCoords(position.lat, position.lng)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Accuracy</dt>
              <dd>±{Math.round(position.accuracy)} m</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Speed</dt>
              <dd>{kmh !== null ? `${kmh} km/h` : 'Not available'}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Tracking</dt>
          <dd>{tracking ? 'Following your movement' : 'Off'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Community reports</dt>
          <dd className="flex items-center gap-1.5">
            <Radio className={`h-3.5 w-3.5 ${realtimeStatus === 'live' ? 'text-emerald-500' : 'text-slate-400'}`} aria-hidden />
            {realtimeStatus === 'live' ? 'Live updates' : realtimeStatus === 'disabled' ? 'Unavailable' : realtimeStatus === 'error' ? 'Reconnecting' : 'Connecting'}
          </dd>
        </div>
      </dl>

      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{error}</p>}

      <p className="mt-3 flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {capabilities.traffic.available
          ? 'Road colours, official incidents (square markers) and travel times use live traffic data from TomTom. Round pins are community reports from drivers and are not verified.'
          : 'No live traffic data is connected. Routes use typical road speeds, and incident markers are unverified community reports.'}
      </p>

      <div className="mt-3 flex gap-2">
        {status !== 'active' ? (
          <button type="button" className="btn-primary flex-1" onClick={geo.locate}>
            <LocateFixed className="h-4 w-4" aria-hidden /> Use my location
          </button>
        ) : (
          <button type="button" className="btn-secondary flex-1" onClick={geo.clear}>
            <MapPinOff className="h-4 w-4" aria-hidden /> Stop using location
          </button>
        )}
      </div>
    </section>
  );
}
