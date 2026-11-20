import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Modal panel: bottom sheet on small screens, centred dialog on larger ones.
export default function Sheet({ title, description, onClose, children, labelledBy = 'sheet-title' }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 animate-fade-in bg-navy-950/50 backdrop-blur-[2px]" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full animate-slide-up overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-overlay outline-none sm:max-w-lg sm:rounded-2xl sm:p-6 dark:border-white/10 dark:bg-navy-800"
      >
        {/* Grab handle on mobile bottom sheets */}
        <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-white/20" aria-hidden />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={labelledBy} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="icon-btn -mt-1 -mr-2 h-9 w-9" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
