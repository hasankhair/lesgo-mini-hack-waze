import { useState } from 'react';
import { Clock, ThumbsDown, ThumbsUp, Trash2, Users } from 'lucide-react';
import { getReportType } from './reportTypes.js';
import { timeAgo, timeUntil } from '../utils/format.js';
import { useNow } from '../hooks/useNow.js';

export default function ReportPopup({ report, onVote, onWithdraw }) {
  const now = useNow(30000);
  const [busy, setBusy] = useState(null);
  const type = getReportType(report.report_type);
  const Icon = type.icon;

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 text-slate-800 dark:text-slate-100">
      <div className="flex items-center gap-3 pr-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: type.color }}>
          <Icon className="h-5 w-5 text-white" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{type.label}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Community report{report.reporter_username ? ` by ${report.reporter_username}` : ''}
          </p>
        </div>
      </div>

      {report.description && <p className="mt-3 text-sm break-words whitespace-pre-line">{report.description}</p>}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          <dt className="sr-only">Reported</dt>
          <dd>
            <time dateTime={report.created_at}>{timeAgo(report.created_at, now)}</time>
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden />
          <dt className="sr-only">Confirmations</dt>
          <dd>
            {report.confirmation_count} confirmed
            {report.not_present_count > 0 ? ` · ${report.not_present_count} gone` : ''}
          </dd>
        </div>
        <div className="col-span-2 text-slate-400">Expires {timeUntil(report.expires_at, now)} unless confirmed</div>
      </dl>

      {report.is_mine ? (
        <button type="button" className="btn-secondary mt-3 w-full" disabled={busy !== null} onClick={() => run('withdraw', () => onWithdraw?.(report))}>
          <Trash2 className="h-4 w-4" aria-hidden /> Withdraw my report
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={report.my_vote === 'confirm'}
            className={`btn ${report.my_vote === 'confirm' ? 'bg-emerald-600 text-white' : 'btn-secondary'}`}
            disabled={busy !== null}
            onClick={() => run('confirm', () => onVote?.(report, 'confirm'))}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden /> Still there
          </button>
          <button
            type="button"
            aria-pressed={report.my_vote === 'not_present'}
            className={`btn ${report.my_vote === 'not_present' ? 'bg-slate-700 text-white' : 'btn-secondary'}`}
            disabled={busy !== null}
            onClick={() => run('not_present', () => onVote?.(report, 'not_present'))}
          >
            <ThumbsDown className="h-4 w-4" aria-hidden /> Not there
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-slate-400">Submitted by drivers. Not verified official traffic information.</p>
    </div>
  );
}
