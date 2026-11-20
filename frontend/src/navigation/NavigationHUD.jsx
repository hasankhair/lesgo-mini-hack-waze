import { Flag, LoaderCircle, LocateFixed, Megaphone, Volume2, VolumeX, X } from 'lucide-react';
import ManeuverIcon from './ManeuverIcon.jsx';
import { formatClock, formatDistance, formatDuration, formatSpeed } from '../utils/format.js';
import { getReportType } from '../reports/reportTypes.js';

// Banner for the nearest community report on the route ahead.
function ReportAhead({ item, extra }) {
  const type = getReportType(item.report.report_type);
  const Icon = type.icon;
  const label = item.report.label || type.label;
  const official = Boolean(item.report.official);
  return (
    <div role="status" className="mt-3 flex items-center gap-3 rounded-xl bg-white/10 p-2.5" aria-label={`${label} ahead in ${formatDistance(item.distanceAhead)}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${official ? 'rounded-lg border-2 border-white/60' : 'rounded-full'}`} style={{ background: type.color }}>
        <Icon className="h-5 w-5 text-white" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {label} ahead · {formatDistance(item.distanceAhead)}
        </p>
        <p className="truncate text-xs text-slate-300">
          {official ? 'Official · TomTom' : `Community report${item.report.confirmation_count > 0 ? ` · ${item.report.confirmation_count} confirmed` : ''}`}
          {extra > 0 ? ` · +${extra} more ahead` : ''}
        </p>
      </div>
    </div>
  );
}

// Turn-by-turn display shown while navigating.
export default function NavigationHUD({
  progress,
  speed,
  rerouting,
  gpsStatus,
  following,
  onRecenter,
  onEnd,
  onReport,
  reportAhead = null,
  reportsAheadCount = 0,
  voice = null,
}) {
  const next = progress?.nextStep;
  const kmh = formatSpeed(speed);

  return (
    <>
      <section
        aria-label="Next turn"
        aria-live="polite"
        className="absolute inset-x-2 top-2 z-[1000] animate-slide-up rounded-2xl bg-navy-900 p-4 pr-14 text-white shadow-2xl sm:left-4 sm:right-auto sm:top-4 sm:w-96"
      >
        {voice?.supported && (
          <button
            type="button"
            onClick={voice.toggle}
            aria-pressed={voice.on}
            aria-label={voice.on ? 'Mute voice guidance' : 'Turn on voice guidance'}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            {voice.on ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-slate-400" />}
          </button>
        )}
        {progress?.arrived ? (
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-go-600">
              <Flag className="h-8 w-8 text-white" aria-hidden />
            </span>
            <div>
              <p className="text-2xl font-bold">You have arrived</p>
              <p className="text-sm text-slate-300">{next?.instruction}</p>
            </div>
          </div>
        ) : progress ? (
          <>
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600">
                <ManeuverIcon step={next} className="h-9 w-9 text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-3xl leading-none font-bold tracking-tight tabular-nums">{formatDistance(progress.distanceToNextStep)}</p>
                <p className="mt-1.5 text-base leading-snug font-medium text-slate-100">{next?.instruction}</p>
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
        {reportAhead && !progress?.arrived && <ReportAhead item={reportAhead} extra={reportsAheadCount - 1} />}
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
        className="panel absolute inset-x-2 bottom-2 z-[1000] flex items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-overlay sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[34rem] sm:-translate-x-1/2 sm:gap-3 sm:p-3"
      >
        <div
          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-slate-200 sm:h-14 sm:w-14 dark:border-white/15"
          aria-label={kmh !== null ? `Speed ${kmh} kilometres per hour` : 'Speed unavailable'}
        >
          <span className="text-base leading-none font-bold sm:text-lg">{kmh ?? '–'}</span>
          <span className="text-[10px] font-medium text-slate-500">km/h</span>
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-3 gap-1 text-center">
          {[
            ['Arrive', progress ? formatClock(progress.eta) : '–'],
            ['Time', progress ? formatDuration(progress.remainingDuration) : '–'],
            ['Distance', progress ? formatDistance(progress.remainingDistance) : '–'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
              <dd className="truncate text-[15px] font-bold whitespace-nowrap text-navy-900 tabular-nums sm:text-lg dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex shrink-0 items-center gap-1.5">
          {!following && (
            <button type="button" className="icon-btn bg-slate-100 dark:bg-white/10" onClick={onRecenter} aria-label="Recenter on my position">
              <LocateFixed className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="icon-btn bg-amber-400 text-navy-900 hover:bg-amber-300 hover:text-navy-900" onClick={onReport} aria-label="Report an incident">
            <Megaphone className="h-5 w-5" />
          </button>
          <button type="button" className="btn-danger h-11 rounded-full px-3 sm:px-4" onClick={onEnd} aria-label="End navigation">
            <X className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">End</span>
          </button>
        </div>
      </section>
    </>
  );
}
