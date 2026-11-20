import { BadgeCheck, Clock, MoveRight, Timer } from 'lucide-react';
import { getReportType } from './reportTypes.js';
import { formatDistance, formatDuration, timeAgo } from '../utils/format.js';

const SEVERITY = { minor: 'Minor delay', moderate: 'Moderate delay', major: 'Major delay' };

// Details for an official traffic incident (TomTom).
export default function IncidentPopup({ incident }) {
  const type = getReportType(incident.category);
  const Icon = type.icon;
  return (
    <div className="p-4 text-slate-800 dark:text-slate-100">
      <div className="flex items-center gap-3 pr-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-navy-900 shadow-sm dark:border-white/70" style={{ background: type.color }}>
          <Icon className="h-5 w-5 text-white" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base leading-tight font-semibold">{incident.label}</h3>
          <p className="mt-1">
            <span className="badge-success">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Official traffic data · TomTom
            </span>
          </p>
        </div>
      </div>
      {incident.description && incident.description !== incident.label && <p className="mt-3 text-sm leading-relaxed">{incident.description}</p>}
      {(incident.from || incident.to) && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700 dark:bg-white/5 dark:text-slate-200">
          {incident.roadNumbers?.length > 0 && <span className="badge-neutral">{incident.roadNumbers.join(', ')}</span>}
          {incident.from} {incident.to && <MoveRight className="h-3 w-3" aria-hidden />} {incident.to}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] text-slate-600 dark:text-slate-300">
        {incident.delaySeconds > 0 && (
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" aria-hidden />
            <dt className="sr-only">Delay</dt>
            <dd>+{formatDuration(incident.delaySeconds)} delay</dd>
          </div>
        )}
        {incident.lengthMeters > 0 && (
          <div>
            <dt className="sr-only">Length</dt>
            <dd>{formatDistance(incident.lengthMeters)} affected</dd>
          </div>
        )}
        {incident.startTime && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <dt className="sr-only">Started</dt>
            <dd>Started {timeAgo(incident.startTime)}</dd>
          </div>
        )}
        {SEVERITY[incident.severity] && (
          <div>
            <dt className="sr-only">Severity</dt>
            <dd>{SEVERITY[incident.severity]}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
