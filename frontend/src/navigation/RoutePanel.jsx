import { useState } from 'react';
import { Bookmark, ChevronDown, ChevronUp, Info, LoaderCircle, LocateFixed, Navigation, X } from 'lucide-react';
import { formatDistance, formatDuration, formatEta } from '../utils/format.js';
import ManeuverIcon from './ManeuverIcon.jsx';

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
      className="panel absolute inset-x-2 bottom-24 z-[1000] flex max-h-[48vh] animate-slide-up flex-col overflow-hidden sm:inset-x-auto sm:top-20 sm:bottom-auto sm:left-4 sm:max-h-[calc(100vh-7rem)] sm:w-96"
    >
      <header className="flex items-start gap-3 border-b border-slate-200 p-4 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Destination</p>
          <h2 className="truncate text-base font-semibold">{destination.name}</h2>
          {destination.label && destination.label !== destination.name && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{destination.label}</p>
          )}
        </div>
        {canSave && (
          <button type="button" className="icon-btn h-9 w-9" onClick={onSave} aria-label="Save this place" title="Save place">
            <Bookmark className="h-5 w-5" />
          </button>
        )}
        <button type="button" className="icon-btn -mr-2 h-9 w-9" onClick={onClose} aria-label="Close route options">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Route preference" className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-white/10">
            {['fastest', 'shortest'].map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={preference === p}
                onClick={() => onPreferenceChange(p)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                  preference === p ? 'bg-white text-brand-700 shadow dark:bg-navy-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <label
            className={`chip cursor-pointer bg-slate-100 dark:bg-white/10 ${tollsSupported ? '' : 'opacity-60'}`}
            title={tollsSupported ? '' : 'Not supported by the current routing provider'}
          >
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={avoidTolls}
              disabled={!tollsSupported}
              onChange={(e) => onAvoidTollsChange(e.target.checked)}
            />
            Avoid tolls
          </label>
        </div>
        {!tollsSupported && (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Toll avoidance is not supported by the current routing provider.</p>
        )}

        {!hasOrigin && (
          <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm dark:bg-brand-500/10">
            <p>Share your location to plan a route from where you are.</p>
            <button type="button" className="btn-primary mt-2 py-2" onClick={onUseLocation} disabled={locationStatus === 'locating'}>
              {locationStatus === 'locating' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Use my location
            </button>
          </div>
        )}

        {loading && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Calculating routes…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
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
                      className={`w-full rounded-xl border-2 p-3 text-left transition ${
                        isSelected ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-lg font-bold">{formatDuration(route.duration)}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">{formatDistance(route.distance)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate">{route.summary ? `via ${route.summary}` : i === 0 ? 'Recommended' : `Alternative ${i}`}</span>
                        <span>Arrive {formatEta(route.duration)}</span>
                      </div>
                      {route.recommended && (
                        <span className="chip mt-2 bg-brand-100 px-2 py-0.5 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                          Recommended · {preference}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {plan.warnings.length > 0 && (
              <ul className="mt-3 space-y-1">
                {plan.warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
                  </li>
                ))}
              </ul>
            )}

            {selected && (
              <div className="mt-3">
                <button type="button" className="flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400" onClick={() => setShowSteps((v) => !v)} aria-expanded={showSteps}>
                  {showSteps ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showSteps ? 'Hide' : 'Show'} directions ({selected.steps.length} steps)
                </button>
                {showSteps && (
                  <ol className="mt-2 divide-y divide-slate-100 text-sm dark:divide-white/5">
                    {selected.steps.map((step, i) => (
                      <li key={i} className="flex items-center gap-3 py-2">
                        <ManeuverIcon step={step} className="h-5 w-5 shrink-0 text-slate-500" />
                        <span className="flex-1">{step.instruction}</span>
                        {step.distance > 0 && <span className="text-xs text-slate-400">{formatDistance(step.distance)}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-slate-200 p-3 dark:border-white/10">
        <button type="button" className="btn-primary w-full py-3 text-base" disabled={!selected || loading} onClick={() => onStart(selected)}>
          <Navigation className="h-5 w-5" aria-hidden /> Start navigation
        </button>
      </footer>
    </section>
  );
}
