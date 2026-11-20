import { useEffect, useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { listMyReports } from '../../services/reportsService.js';
import { getReportType } from '../../reports/reportTypes.js';
import { formatDate } from '../../utils/format.js';
import { Card, EmptyState, ErrorState, ListSkeleton } from './ui.jsx';

export const STATUS = {
  active: ['Active', 'badge-success'],
  cleared: ['Cleared by drivers', 'badge-neutral'],
  expired: ['Expired', 'badge-neutral'],
  removed: ['Withdrawn', 'badge-neutral'],
};

export const effectiveStatus = (r, now = Date.now()) => (r.status === 'active' && new Date(r.expires_at).getTime() <= now ? 'expired' : r.status);

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['past', 'Past'],
];

export function ReportRow({ report: r }) {
  const type = getReportType(r.report_type);
  const Icon = type.icon;
  const [label, cls] = STATUS[effectiveStatus(r)] ?? STATUS.expired;
  return (
    <li className="list-row">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: type.color }}>
        <Icon className="h-5 w-5 text-white" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-navy-900 dark:text-white">{type.label}</p>
        <p className="truncate text-[13px] text-slate-600 dark:text-slate-400">
          {formatDate(r.created_at)} · {r.confirmation_count} confirmed
          {r.description ? ` · ${r.description}` : ''}
        </p>
      </div>
      <span className={cls}>{label}</span>
    </li>
  );
}

export default function MyReports() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    listMyReports(100)
      .then(setReports)
      .catch((err) => setError(err.message));
  }, []);

  const shown = useMemo(() => {
    if (!reports) return [];
    if (filter === 'active') return reports.filter((r) => effectiveStatus(r) === 'active');
    if (filter === 'past') return reports.filter((r) => effectiveStatus(r) !== 'active');
    return reports;
  }, [reports, filter]);

  return (
    <Card
      title="Traffic reports"
      description="Everything you have reported, including expired reports."
      bodyClassName=""
      actions={
        reports?.length > 0 && (
          <div role="radiogroup" aria-label="Filter reports" className="segmented">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={filter === id} className="segment" onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        )
      }
    >
      {error && <ErrorState message={error} />}
      {reports === null && !error && <ListSkeleton />}
      {reports?.length === 0 && (
        <EmptyState icon={Megaphone} title="You haven’t reported anything yet." text="Use the Report button on the map to warn other drivers about accidents, jams and hazards." />
      )}
      {reports?.length > 0 && shown.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No {filter} reports.</p>}
      {shown.length > 0 && <ul className="divide-y divide-slate-100 dark:divide-white/5">{shown.map((r) => <ReportRow key={r.id} report={r} />)}</ul>}
    </Card>
  );
}
