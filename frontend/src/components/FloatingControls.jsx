import { Gauge, LoaderCircle, LocateFixed, Megaphone, Minus, Plus, Route } from 'lucide-react';

// Bottom control bar (My Location, Report, Route Options, Navigation Info)
// plus zoom buttons on the right edge.
export default function FloatingControls({
  onLocate,
  locating,
  locationActive,
  onReport,
  onRouteOptions,
  routeOptionsAvailable,
  routeOpen,
  onInfo,
  infoOpen,
  onZoomIn,
  onZoomOut,
}) {
  const barBtn =
    'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-slate-600 transition-colors ' +
    'hover:bg-slate-100 hover:text-navy-900 active:bg-slate-200 aria-pressed:bg-brand-50 aria-pressed:text-brand-700 ' +
    'disabled:pointer-events-none disabled:opacity-40 ' +
    'dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:aria-pressed:bg-brand-500/15 dark:aria-pressed:text-brand-200';

  return (
    <>
      <div className="absolute top-1/2 right-4 z-[900] hidden -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/[0.97] shadow-float sm:flex dark:border-white/10 dark:bg-navy-800/[0.97]">
        <button type="button" className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" onClick={onZoomIn} aria-label="Zoom in">
          <Plus className="h-5 w-5" />
        </button>
        <div className="mx-2 border-t divider" />
        <button type="button" className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" onClick={onZoomOut} aria-label="Zoom out">
          <Minus className="h-5 w-5" />
        </button>
      </div>

      <nav
        aria-label="Map controls"
        className="panel absolute inset-x-2 bottom-2 z-[900] flex items-center gap-1 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2"
      >
        <button type="button" className={barBtn} onClick={onLocate} aria-label="My location">
          {locating ? (
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className={`h-5 w-5 ${locationActive ? 'text-brand-600 dark:text-brand-300' : ''}`} aria-hidden />
          )}
          My location
        </button>
        <button
          type="button"
          onClick={onReport}
          className="mx-0.5 flex h-14 flex-[1.25] flex-col items-center justify-center gap-1 rounded-xl bg-amber-400 text-xs font-bold text-navy-900 shadow-sm transition hover:bg-amber-300 active:scale-[0.97] active:bg-amber-500"
        >
          <Megaphone className="h-5 w-5" aria-hidden />
          Report
        </button>
        <button
          type="button"
          className={barBtn}
          onClick={onRouteOptions}
          disabled={!routeOptionsAvailable}
          aria-pressed={Boolean(routeOpen)}
          aria-label="Route options"
          title={routeOptionsAvailable ? 'Route options' : 'Search for a destination first'}
        >
          <Route className="h-5 w-5" aria-hidden />
          Route
        </button>
        <button type="button" className={barBtn} onClick={onInfo} aria-pressed={infoOpen} aria-label="Navigation information">
          <Gauge className="h-5 w-5" aria-hidden />
          Info
        </button>
      </nav>
    </>
  );
}
