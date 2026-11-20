import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Briefcase, CircleCheck, House, MapPin, Megaphone, Navigation, Plus, Route, ThumbsUp } from 'lucide-react';
import { listHistory, listSavedLocations } from '../../services/accountService.js';
import { listMyReports } from '../../services/reportsService.js';
import { getReportType } from '../../reports/reportTypes.js';
import { formatDistance, formatDuration } from '../../utils/format.js';
import { navigateHref } from './SavedPlaces.jsx';
import { ReportRow, effectiveStatus } from './MyReports.jsx';
import { Card, EmptyState, ErrorState, IconTile, ListSkeleton, StatCard } from './ui.jsx';

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 100;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

// Trips per day for the last `days` days, oldest first.
export function tripsPerDay(history, days = 14, now = Date.now()) {
  const today = startOfDay(now);
  const buckets = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, count: 0 }));
  for (const trip of history) {
    const t = startOfDay(trip.created_at);
    const idx = Math.round((t - buckets[0].day) / DAY);
    if (idx >= 0 && idx < days) buckets[idx].count += 1;
  }
  return buckets;
}

// Report counts by category, largest first.
export function reportsByCategory(reports) {
  const counts = new Map();
  for (const r of reports) counts.set(r.report_type, (counts.get(r.report_type) ?? 0) + 1);
  return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}

export function summarize(history, reports, now = Date.now()) {
  const recent = history.filter((t) => now - new Date(t.created_at).getTime() <= 30 * DAY);
  return {
    trips30: recent.length,
    distance30: recent.reduce((s, t) => s + (t.distance_meters || 0), 0),
    duration30: recent.reduce((s, t) => s + (t.estimated_duration_seconds || 0), 0),
    reports: reports.length,
    activeReports: reports.filter((r) => effectiveStatus(r, now) === 'active').length,
    confirmations: reports.reduce((s, r) => s + (r.confirmation_count || 0), 0),
  };
}

function TripsChart({ buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const short = new Intl.DateTimeFormat(undefined, { day: 'numeric' });
  return (
    <figure>
      <div className="flex h-40 items-end gap-1.5 sm:gap-2" role="img" aria-label={`${total} trips in the last ${buckets.length} days`}>
        {buckets.map((b, i) => {
          const isToday = i === buckets.length - 1;
          return (
            <div key={b.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${fmt.format(b.day)}: ${b.count} trip${b.count === 1 ? '' : 's'}`}>
              {b.count > 0 && (
                <span className="mb-1 text-center text-[11px] font-semibold text-slate-600 tabular-nums dark:text-slate-300">{b.count}</span>
              )}
              <div
                className={`w-full rounded-md transition-colors ${b.count ? (isToday ? 'bg-brand-600' : 'bg-brand-400 group-hover:bg-brand-500') : 'bg-slate-100 dark:bg-white/5'}`}
                style={{ height: b.count ? `${Math.max(8, (b.count / max) * 100)}%` : '4px' }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2" aria-hidden>
        {buckets.map((b, i) => (
          <span key={b.day} className={`flex-1 text-center text-[11px] tabular-nums ${i === buckets.length - 1 ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-slate-500'}`}>
            {i % 2 === buckets.length % 2 || i === buckets.length - 1 ? short.format(b.day) : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

function CategoryBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-3.5">
      {data.slice(0, 5).map(({ type, count }) => {
        const t = getReportType(type);
        const Icon = t.icon;
        return (
          <li key={type}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: t.color }}>
                  <Icon className="h-3.5 w-3.5 text-white" aria-hidden />
                </span>
                {t.label}
              </span>
              <span className="font-semibold text-navy-900 tabular-nums dark:text-white">{count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: t.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QuickPlace({ place, icon, label }) {
  if (!place) {
    return (
      <Link to="/dashboard/places" className="card flex items-center gap-3 border-dashed p-4 transition hover:border-brand-300 hover:bg-brand-50/40 dark:hover:bg-white/5">
        <IconTile icon={Plus} tone="navy" />
        <div className="min-w-0">
          <p className="font-semibold text-navy-900 dark:text-white">Add {label}</p>
          <p className="text-[13px] text-muted">Save it for one-tap navigation</p>
        </div>
      </Link>
    );
  }
  return (
    <Link
      to={navigateHref({ name: place.location_name, label: place.address, lat: place.latitude, lng: place.longitude })}
      className="card group flex items-center gap-3 p-4 transition hover:border-brand-300 hover:shadow-float"
      aria-label={`Navigate to ${label}`}
    >
      <IconTile icon={icon} tone="brand" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy-900 dark:text-white">{label}</p>
        <p className="truncate text-[13px] text-muted">{place.address || place.location_name}</p>
      </div>
      <Navigation className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-brand-600" aria-hidden />
    </Link>
  );
}

export default function Overview({ profile }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([listHistory(HISTORY_LIMIT), listMyReports(100), listSavedLocations()])
      .then(([history, reports, places]) => setData({ history, reports, places }))
      .catch((err) => setError(err.message));
  }, []);

  const stats = useMemo(() => (data ? summarize(data.history, data.reports) : null), [data]);
  const buckets = useMemo(() => (data ? tripsPerDay(data.history) : []), [data]);
  const categories = useMemo(() => (data ? reportsByCategory(data.reports) : []), [data]);

  if (error) return <ErrorState message={error} />;

  const home = data?.places.find((p) => p.category === 'home');
  const work = data?.places.find((p) => p.category === 'work');
  const hours = stats ? stats.duration30 / 3600 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats ? (
          <>
            <StatCard icon={Route} label="Trips" value={stats.trips30} hint="Last 30 days" tone="brand" />
            <StatCard
              icon={MapPin}
              label="Distance planned"
              value={formatDistance(stats.distance30)}
              hint={hours >= 1 ? `About ${formatDuration(stats.duration30)} of driving` : 'Last 30 days'}
              tone="navy"
            />
            <StatCard icon={Megaphone} label="Reports" value={stats.reports} hint={`${stats.activeReports} active now`} tone="amber" />
            <StatCard icon={ThumbsUp} label="Confirmations" value={stats.confirmations} hint="From other drivers" tone="go" />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <div key={i} className="card h-[132px] animate-pulse bg-slate-50 dark:bg-white/5" />)
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickPlace place={home} icon={House} label="Home" />
        <QuickPlace place={work} icon={Briefcase} label="Work" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Trips in the last 14 days"
          description={data?.history.length >= HISTORY_LIMIT ? `Based on your latest ${HISTORY_LIMIT} trips.` : 'Each bar is one day.'}
        >
          {!data ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-50 dark:bg-white/5" />
          ) : buckets.some((b) => b.count) ? (
            <TripsChart buckets={buckets} />
          ) : (
            <EmptyState icon={BarChart3} title="No trips in the last 14 days." text="Start navigating to a destination and your trips will appear here." />
          )}
        </Card>
        <Card className="lg:col-span-2" title="Your reports by type" description={data ? `${data.reports.length} total` : ''}>
          {!data ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-50 dark:bg-white/5" />
          ) : categories.length ? (
            <CategoryBars data={categories} />
          ) : (
            <EmptyState icon={Megaphone} title="No reports yet." text="Reports you submit from the map are counted here." />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Recent trips"
          bodyClassName=""
          actions={
            <Link to="/dashboard/history" className="btn-ghost btn-sm text-brand-700 dark:text-brand-300">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        >
          {!data ? (
            <ListSkeleton rows={3} />
          ) : data.history.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {data.history.slice(0, 4).map((trip) => (
                <li key={trip.id} className="list-row">
                  <IconTile icon={MapPin} tone="navy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy-900 dark:text-white">{trip.destination_label}</p>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400">
                      {formatDistance(trip.distance_meters)} · {formatDuration(trip.estimated_duration_seconds)}
                    </p>
                  </div>
                  <Link
                    to={navigateHref({ name: trip.destination_label, lat: trip.destination_latitude, lng: trip.destination_longitude })}
                    className="icon-btn h-9 w-9"
                    aria-label={`Navigate to ${trip.destination_label}`}
                  >
                    <Navigation className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Route} title="No trips yet." />
          )}
        </Card>
        <Card
          title="Recent reports"
          bodyClassName=""
          actions={
            <Link to="/dashboard/reports" className="btn-ghost btn-sm text-brand-700 dark:text-brand-300">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        >
          {!data ? (
            <ListSkeleton rows={3} />
          ) : data.reports.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {data.reports.slice(0, 4).map((r) => (
                <ReportRow key={r.id} report={r} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={CircleCheck} title="No reports yet." />
          )}
        </Card>
      </div>
      {profile?.save_history === false && (
        <p className="alert-neutral">Navigation history is turned off in Settings, so new trips aren’t counted.</p>
      )}
    </div>
  );
}
