import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Modal panel: bottom sheet on small screens, centred dialog on larger ones.
export default function Sheet({ title, onClose, children, labelledBy = 'sheet-title' }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="panel relative max-h-[90vh] w-full animate-slide-up overflow-y-auto rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={labelledBy} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="icon-btn -mr-2 h-9 w-9" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
