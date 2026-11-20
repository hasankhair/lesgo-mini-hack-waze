import { Flag, LoaderCircle, LocateFixed, Megaphone, X } from 'lucide-react';
import ManeuverIcon from './ManeuverIcon.jsx';
import { formatClock, formatDistance, formatDuration, formatSpeed } from '../utils/format.js';

// Turn-by-turn display shown while navigating.
export default function NavigationHUD({ progress, speed, rerouting, gpsStatus, following, onRecenter, onEnd, onReport }) {
  const next = progress?.nextStep;
  const kmh = formatSpeed(speed);

  return (
    <>
      <section
        aria-label="Next turn"
        aria-live="polite"
        className="absolute inset-x-2 top-2 z-[1000] animate-slide-up rounded-2xl bg-navy-900 p-4 text-white shadow-2xl sm:left-4 sm:right-auto sm:top-4 sm:w-96"
      >
        {progress?.arrived ? (
          <div className="flex items-center gap-4">
            <Flag className="h-10 w-10 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <p className="text-2xl font-bold">You have arrived</p>
              <p className="text-sm text-slate-300">{next?.instruction}</p>
            </div>
          </div>
        ) : progress ? (
          <>
            <div className="flex items-center gap-4">
              <ManeuverIcon step={next} className="h-12 w-12 shrink-0 text-brand-300" />
              <div className="min-w-0">
                <p className="text-3xl leading-none font-bold">{formatDistance(progress.distanceToNextStep)}</p>
                <p className="mt-1 text-base leading-snug font-medium">{next?.instruction}</p>
              </div>
            </div>
            {progress.followingStep && (
              <p className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2 text-sm text-slate-300">
                Then <ManeuverIcon step={progress.followingStep} className="h-4 w-4" /> {progress.followingStep.instruction}
              </p>
            )}
          </>
        ) : (
          <p className="flex items-center gap-2 text-lg">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
            {gpsStatus === 'denied' ? 'Location permission is needed to navigate.' : 'Waiting for GPS signal…'}
          </p>
        )}
        {rerouting && (
          <p className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/20 px-2 py-1 text-sm text-amber-200">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Off route, recalculating…
          </p>
        )}
        {(gpsStatus === 'unavailable' || gpsStatus === 'timeout') && (
          <p className="mt-2 rounded-lg bg-red-500/20 px-2 py-1 text-sm text-red-200">GPS signal lost. Directions may be out of date.</p>
        )}
      </section>

      <section
        aria-label="Trip information"
        className="panel absolute inset-x-2 bottom-2 z-[1000] flex items-center gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[32rem] sm:-translate-x-1/2"
      >
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-4 border-slate-200 dark:border-white/15"
          aria-label={kmh !== null ? `Speed ${kmh} kilometres per hour` : 'Speed unavailable'}
        >
          <span className="text-lg leading-none font-bold">{kmh ?? '–'}</span>
          <span className="text-[10px] text-slate-500">km/h</span>
        </div>
        <dl className="grid flex-1 grid-cols-3 gap-1 text-center">
          <div>
            <dt className="text-[11px] text-slate-500 uppercase">Arrive</dt>
            <dd className="text-lg font-bold">{progress ? formatClock(progress.eta) : '–'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500 uppercase">Time</dt>
            <dd className="text-lg font-bold">{progress ? formatDuration(progress.remainingDuration) : '–'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500 uppercase">Distance</dt>
            <dd className="text-lg font-bold">{progress ? formatDistance(progress.remainingDistance) : '–'}</dd>
          </div>
        </dl>
        {!following && (
          <button type="button" className="icon-btn bg-slate-100 dark:bg-white/10" onClick={onRecenter} aria-label="Recenter on my position">
            <LocateFixed className="h-5 w-5" />
          </button>
        )}
        <button type="button" className="icon-btn bg-amber-400 text-navy-900 hover:bg-amber-300" onClick={onReport} aria-label="Report an incident">
          <Megaphone className="h-5 w-5" />
        </button>
        <button type="button" className="btn-danger h-12 rounded-full px-4" onClick={onEnd}>
          <X className="h-5 w-5" aria-hidden /> End
        </button>
      </section>
    </>
  );
}
