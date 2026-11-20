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
  onInfo,
  infoOpen,
  onZoomIn,
  onZoomOut,
}) {
  const barBtn = 'flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40';

  return (
    <>
      <div className="absolute top-1/2 right-3 z-[900] hidden -translate-y-1/2 flex-col gap-2 sm:flex">
        <button type="button" className="fab" onClick={onZoomIn} aria-label="Zoom in">
          <Plus className="h-5 w-5" />
        </button>
        <button type="button" className="fab" onClick={onZoomOut} aria-label="Zoom out">
          <Minus className="h-5 w-5" />
        </button>
      </div>

      <nav
        aria-label="Map controls"
        className="panel absolute inset-x-2 bottom-2 z-[900] flex items-center gap-1 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[30rem] sm:-translate-x-1/2"
      >
        <button type="button" className={barBtn} onClick={onLocate} aria-label="My location">
          {locating ? (
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className={`h-5 w-5 ${locationActive ? 'text-brand-600 dark:text-brand-400' : ''}`} aria-hidden />
          )}
          My location
        </button>
        <button
          type="button"
          onClick={onReport}
          className="mx-1 flex h-14 flex-[1.3] flex-col items-center justify-center gap-0.5 rounded-xl bg-amber-400 text-[11px] font-semibold text-navy-900 shadow-md transition hover:bg-amber-300 active:scale-95"
        >
          <Megaphone className="h-5 w-5" aria-hidden />
          Report
        </button>
        <button type="button" className={barBtn} onClick={onRouteOptions} disabled={!routeOptionsAvailable} aria-label="Route options">
          <Route className="h-5 w-5" aria-hidden />
          Route
        </button>
        <button type="button" className={`${barBtn} ${infoOpen ? 'bg-slate-100 dark:bg-white/10' : ''}`} onClick={onInfo} aria-pressed={infoOpen} aria-label="Navigation information">
          <Gauge className="h-5 w-5" aria-hidden />
          Info
        </button>
      </nav>
    </>
  );
}
