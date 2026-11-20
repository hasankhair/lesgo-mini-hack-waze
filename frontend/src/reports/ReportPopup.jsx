import { useState } from 'react';
import { Clock, Hourglass, ThumbsDown, ThumbsUp, Trash2, Users } from 'lucide-react';
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
      <div className="flex items-center gap-3 pr-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: type.color }}>
          <Icon className="h-5 w-5 text-white" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base leading-tight font-semibold">{type.label}</h3>
          <p className="mt-0.5 truncate text-[13px] text-slate-600 dark:text-slate-400">
            Community report{report.reporter_username ? ` by ${report.reporter_username}` : ''}
          </p>
        </div>
      </div>

      {report.description && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-line dark:bg-white/5">{report.description}</p>
      )}

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <dt className="sr-only">Reported</dt>
          <dd>
            <time dateTime={report.created_at}>{timeAgo(report.created_at, now)}</time>
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <dt className="sr-only">Confirmations</dt>
          <dd>
            {report.confirmation_count} confirmed
            {report.not_present_count > 0 ? ` · ${report.not_present_count} gone` : ''}
          </dd>
        </div>
        <div className="flex w-full items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <Hourglass className="h-3.5 w-3.5" aria-hidden />
          <dt className="sr-only">Expires</dt>
          <dd>Expires {timeUntil(report.expires_at, now)} unless confirmed</dd>
        </div>
      </dl>

      {report.is_mine ? (
        <button type="button" className="btn-secondary mt-4 w-full" disabled={busy !== null} onClick={() => run('withdraw', () => onWithdraw?.(report))}>
          <Trash2 className="h-4 w-4" aria-hidden /> Withdraw my report
        </button>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-medium text-slate-700 dark:text-slate-200">Is it still there?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={report.my_vote === 'confirm'}
              className={`btn-secondary ${report.my_vote === 'confirm' ? 'border-go-600 bg-go-600 text-white hover:border-go-700 hover:bg-go-700' : ''}`}
              disabled={busy !== null}
              onClick={() => run('confirm', () => onVote?.(report, 'confirm'))}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden /> Still there
            </button>
            <button
              type="button"
              aria-pressed={report.my_vote === 'not_present'}
              className={`btn-secondary ${report.my_vote === 'not_present' ? 'border-navy-700 bg-navy-700 text-white hover:bg-navy-800' : ''}`}
              disabled={busy !== null}
              onClick={() => run('not_present', () => onVote?.(report, 'not_present'))}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden /> Not there
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 border-t divider pt-2.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
        Submitted by drivers. Not verified official traffic information.
      </p>
    </div>
  );
}
