import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: ['bg-go-100 text-go-700 dark:bg-go-500/15 dark:text-green-300', CircleCheck],
  error: ['bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', CircleAlert],
  info: ['bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200', Info],
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (message, type = 'info', { duration = 4000 } = {}) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-3), { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-20 z-[2000] flex flex-col items-center gap-2 px-4 sm:top-24"
      >
        {toasts.map((t) => {
          const [color, Icon] = STYLES[t.type] || STYLES.info;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="panel pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 p-3 pr-2 shadow-overlay"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <p className="flex-1 self-center text-sm leading-snug font-medium text-slate-800 dark:text-slate-100">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="icon-btn h-8 w-8" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
