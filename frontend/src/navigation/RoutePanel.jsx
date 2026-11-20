import { useState } from 'react';
import { Bookmark, ChevronDown, Clock, Info, LoaderCircle, LocateFixed, MapPin, Navigation, Radio, X } from 'lucide-react';
import { formatDistance, formatDuration, formatEta } from '../utils/format.js';
import ManeuverIcon from './ManeuverIcon.jsx';

function TrafficNote({ delay }) {
  if (delay >= 60) {
    const heavy = delay >= 300;
    return (
      <span className={heavy ? 'badge-danger' : 'badge-warning'}>
        +{formatDuration(delay)} traffic
      </span>
    );
  }
  return <span className="badge-success">Light traffic</span>;
}

// Route planning panel: destination, preferences, recommended/alternative
// routes, and the Start navigation action.
export default function RoutePanel({
  destination,
  hasOrigin,
  onUseLocation,
  locationStatus,
  plan,
  loading,
  error,
  selectedRouteId,
  onSelectRoute,
  preference,
  onPreferenceChange,
  avoidTolls,
  onAvoidTollsChange,
  capabilities,
  onStart,
  onSave,
  canSave,
  onClose,
}) {
  const [showSteps, setShowSteps] = useState(false);
  const selected = plan?.routes.find((r) => r.id === selectedRouteId) ?? plan?.routes[0];
  const tollsSupported = capabilities.routing.supportsAvoidTolls;

  return (
    <section
      aria-label="Route options"
      className="panel absolute inset-x-2 bottom-[5.5rem] z-[1000] flex max-h-[52dvh] animate-slide-up flex-col overflow-hidden shadow-overlay sm:inset-x-auto sm:top-[4.75rem] sm:bottom-auto sm:left-4 sm:max-h-[calc(100dvh-7.5rem)] sm:w-[25rem]"
    >
      <header className="flex items-start gap-3 border-b divider px-4 pt-4 pb-3.5">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white dark:bg-white/10">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Destination</p>
          <h2 className="truncate text-[17px] leading-snug font-semibold">{destination.name}</h2>
          {destination.label && destination.label !== destination.name && (
            <p className="truncate text-[13px] text-slate-600 dark:text-slate-400">{destination.label}</p>
          )}
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          {canSave && (
            <button type="button" className="icon-btn h-9 w-9" onClick={onSave} aria-label="Save this place" title="Save place">
              <Bookmark className="h-[18px] w-[18px]" />
            </button>
          )}
          <button type="button" className="icon-btn h-9 w-9" onClick={onClose} aria-label="Close route options">
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="overflow-y-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Route preference" className="segmented">
            {['fastest', 'shortest'].map((p) => (
              <button key={p} type="button" role="radio" aria-checked={preference === p} onClick={() => onPreferenceChange(p)} className="segment capitalize">
                {p}
              </button>
            ))}
          </div>
          <label
            className={`inline-flex items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200 ${tollsSupported ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            title={tollsSupported ? '' : 'Not supported by the current routing provider'}
          >
            <input type="checkbox" className="checkbox" checked={avoidTolls} disabled={!tollsSupported} onChange={(e) => onAvoidTollsChange(e.target.checked)} />
            Avoid tolls
          </label>
        </div>
        {!tollsSupported && <p className="hint">Toll avoidance is not supported by the current routing provider.</p>}

        {!hasOrigin && (
          <div className="alert-info mt-4 flex-col">
            <p>Share your location to plan a route from where you are.</p>
            <button type="button" className="btn-primary btn-sm self-start" onClick={onUseLocation} disabled={locationStatus === 'locating'}>
              {locationStatus === 'locating' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Use my location
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-4 space-y-2" role="status" aria-label="Calculating routes">
            {[0, 1].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
            ))}
            <p className="flex items-center gap-2 text-sm text-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Calculating routes…
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="alert-error mt-4">
            {error}
          </p>
        )}

        {plan && !loading && (
          <>
            <ul className="mt-4 space-y-2" aria-label="Available routes">
              {plan.routes.map((route, i) => {
                const isSelected = route.id === selected?.id;
                return (
                  <li key={route.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRoute(route.id)}
                      aria-pressed={isSelected}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500 dark:bg-brand-500/10'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-xl font-bold tracking-tight ${isSelected ? 'text-brand-700 dark:text-brand-200' : 'text-navy-900 dark:text-white'}`}>
                          {formatDuration(route.duration)}
                        </span>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{formatDistance(route.distance)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-slate-600 dark:text-slate-400">
                        <span className="truncate">{route.summary ? `via ${route.summary}` : i === 0 ? 'Recommended' : `Alternative ${i}`}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden /> {formatEta(route.duration)}
                        </span>
                      </div>
                      {(route.recommended || plan.trafficAware) && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {route.recommended && <span className="badge-info capitalize">Recommended · {preference}</span>}
                          {plan.trafficAware && <TrafficNote delay={route.trafficDelay ?? 0} />}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {(plan.trafficAware || plan.warnings.length > 0) && (
              <ul className="mt-3 space-y-1.5">
                {plan.trafficAware && (
                  <li className="flex gap-2 text-[13px] text-slate-600 dark:text-slate-400">
                    <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-go-600" aria-hidden /> Travel times include live traffic from TomTom.
                  </li>
                )}
                {plan.warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-[13px] text-slate-600 dark:text-slate-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
                  </li>
                ))}
              </ul>
            )}

            {selected && (
              <div className="mt-4 border-t divider pt-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg py-1 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300"
                  onClick={() => setShowSteps((v) => !v)}
                  aria-expanded={showSteps}
                >
                  {showSteps ? 'Hide' : 'Show'} directions ({selected.steps.length} steps)
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSteps ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {showSteps && (
                  <ol className="mt-2 divide-y divide-slate-100 text-sm dark:divide-white/5">
                    {selected.steps.map((step, i) => (
                      <li key={i} className="flex items-center gap-3 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                          <ManeuverIcon step={step} className="h-4 w-4" />
                        </span>
                        <span className="flex-1 leading-snug text-slate-800 dark:text-slate-200">{step.instruction}</span>
                        {step.distance > 0 && <span className="shrink-0 text-[13px] text-slate-500">{formatDistance(step.distance)}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="border-t divider p-3">
        <button type="button" className="btn-primary btn-lg w-full" disabled={!selected || loading} onClick={() => onStart(selected)}>
          <Navigation className="h-5 w-5" aria-hidden /> Start navigation
        </button>
      </footer>
    </section>
  );
}
