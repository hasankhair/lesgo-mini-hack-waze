// Shared building blocks for dashboard pages, so every section uses the same
// spacing, type sizes and states.
import { CircleAlert } from 'lucide-react';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, actions, children, className = '', bodyClassName = 'p-5', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b divider px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200',
  go: 'bg-go-50 text-go-700 dark:bg-go-500/15 dark:text-green-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  navy: 'bg-slate-100 text-navy-800 dark:bg-white/10 dark:text-slate-100',
};

export function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-navy-900 tabular-nums dark:text-white">{value}</p>
      {hint && <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function IconTile({ icon: Icon, tone = 'brand', className = 'h-10 w-10' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl ${TONES[tone]} ${className}`}>
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-navy-900 dark:text-white">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-white/5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <p role="alert" className="alert-error m-4">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

// Accessible on/off switch.
export function Switch({ checked, onChange, disabled, label, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-300 transition-colors aria-checked:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:bg-white/20"
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  );
}
