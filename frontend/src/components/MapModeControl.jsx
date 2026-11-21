import { Box, LoaderCircle, Navigation2 } from 'lucide-react';

// 2D/3D switch, plus a compass that resets the map to north when the 3D view
// has been rotated. Sits above the bottom bar on the right.
export default function MapModeControl({ is3D, loading, onToggle, bearing = 0, onResetNorth, className = '' }) {
  const rotated = is3D && Math.abs(((bearing % 360) + 360) % 360) > 2 && Math.abs(((bearing % 360) + 360) % 360) < 358;
  return (
    <div className={`absolute right-3 z-[950] flex flex-col items-end gap-2 sm:right-4 ${className}`}>
      {rotated && (
        <button
          type="button"
          onClick={onResetNorth}
          className="fab"
          aria-label="Reset map to north"
          title="Reset to north"
        >
          <Navigation2 className="h-5 w-5 text-red-500 transition-transform" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={is3D}
        aria-label={is3D ? 'Switch to 2D map' : 'Switch to 3D map'}
        title={is3D ? 'Switch to 2D map' : 'Switch to 3D map'}
        className="panel flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold text-slate-700 transition hover:text-brand-700 active:scale-95 aria-pressed:border-brand-500 aria-pressed:bg-brand-600 aria-pressed:text-white dark:text-slate-200 dark:aria-pressed:bg-brand-600 dark:aria-pressed:text-white"
      >
        {loading ? <LoaderCircle className="h-4.5 w-4.5 animate-spin" aria-hidden /> : <Box className="h-4.5 w-4.5" aria-hidden />}
        {is3D ? '3D' : '2D'}
      </button>
    </div>
  );
}
