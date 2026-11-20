import { useEffect, useState } from 'react';
import { listMyReports } from '../../services/reportsService.js';
import { getReportType } from '../../reports/reportTypes.js';
import { formatDate } from '../../utils/format.js';

const STATUS = {
  active: ['Active', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'],
  cleared: ['Cleared by drivers', 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'],
  expired: ['Expired', 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'],
  removed: ['Withdrawn', 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'],
};

const effectiveStatus = (r) => (r.status === 'active' && new Date(r.expires_at) <= new Date() ? 'expired' : r.status);

export default function MyReports() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listMyReports(100)
      .then(setReports)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading" className="text-lg font-semibold">
        My traffic reports
      </h2>
      <p className="text-sm text-slate-500">Everything you have reported, including expired reports.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      {reports === null && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {reports?.length === 0 && <p className="mt-4 text-sm text-slate-500">You haven’t reported anything yet.</p>}
      <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
        {reports?.map((r) => {
          const type = getReportType(r.report_type);
          const Icon = type.icon;
          const [label, cls] = STATUS[effectiveStatus(r)] ?? STATUS.expired;
          return (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: type.color }}>
                <Icon className="h-5 w-5 text-white" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{type.label}</p>
                <p className="truncate text-xs text-slate-500">
                  {formatDate(r.created_at)} · {r.confirmation_count} confirmed
                  {r.description ? ` · ${r.description}` : ''}
                </p>
              </div>
              <span className={`chip ${cls}`}>{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
