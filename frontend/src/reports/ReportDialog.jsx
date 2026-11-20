import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crosshair, LoaderCircle, LocateFixed, LogIn } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import { REPORT_TYPES } from './reportTypes.js';
import { formatCoords } from '../utils/format.js';

const MAX_DESCRIPTION = 280;

// Report form. The incident location is either the driver's GPS position or
// the centre of the map (for reporting something seen elsewhere).
export default function ReportDialog({ user, userPosition, mapCenter, onSubmit, onClose }) {
  const [type, setType] = useState(null);
  const [description, setDescription] = useState('');
  const [where, setWhere] = useState(userPosition ? 'gps' : 'center');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!user) {
    return (
      <Sheet title="Report an incident" onClose={onClose}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            <LogIn className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-[15px] leading-relaxed text-muted">
            Sign in to share road conditions with other drivers. You can browse reports without an account.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <Link to="/login" state={{ from: '/' }} className="btn-primary btn-lg flex-1">
            Sign in
          </Link>
          <Link to="/register" className="btn-secondary btn-lg flex-1">
            Create account
          </Link>
        </div>
      </Sheet>
    );
  }

  const location = where === 'gps' && userPosition ? userPosition : mapCenter;

  const submit = async (e) => {
    e.preventDefault();
    if (!type) {
      setError('Choose what you want to report.');
      return;
    }
    if (!location) {
      setError('No location available. Enable GPS or move the map to the incident.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ report_type: type, description: description.trim(), latitude: location.lat, longitude: location.lng });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not submit the report.');
      setSubmitting(false);
    }
  };

  return (
    <Sheet title="Report an incident" description="Help other drivers by sharing what you see." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend className="label">What&apos;s happening?</legend>
          <div className="grid grid-cols-3 gap-2">
            {REPORT_TYPES.map(({ value, label, color, icon: Icon }) => {
              const active = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setType(value)}
                  className={`relative flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border px-1.5 py-3 text-[13px] font-medium transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5'
                  }`}
                >
                  {active && (
                    <span className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand-600 text-white" aria-hidden>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                  <span className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm" style={{ background: color }}>
                    <Icon className="h-5 w-5 text-white" aria-hidden />
                  </span>
                  <span className="text-center leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="label">Location</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={where === 'gps'}
              disabled={!userPosition}
              onClick={() => setWhere('gps')}
              className={`btn-secondary ${where === 'gps' ? 'btn-selected' : ''}`}
            >
              <LocateFixed className="h-4 w-4" aria-hidden /> My location
            </button>
            <button
              type="button"
              aria-pressed={where === 'center'}
              onClick={() => setWhere('center')}
              className={`btn-secondary ${where === 'center' ? 'btn-selected' : ''}`}
            >
              <Crosshair className="h-4 w-4" aria-hidden /> Map centre
            </button>
          </div>
          <p className="hint font-mono text-[12px]">
            {location ? formatCoords(location.lat, location.lng) : 'No location yet'}
            {!userPosition && ' · GPS not available, using the map centre'}
          </p>
        </fieldset>

        <div className="mt-5">
          <label htmlFor="report-description" className="label">
            Details <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="report-description"
            className="textarea"
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Left lane blocked"
          />
          <p className="mt-1 text-right text-xs text-slate-500">
            {description.length}/{MAX_DESCRIPTION}
          </p>
        </div>

        {error && (
          <p role="alert" className="alert-error mb-3">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary btn-lg w-full" disabled={submitting}>
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
          Submit report
        </button>
        <p className="mt-2.5 text-center text-caption">Reports are public and expire automatically. Please report only when safe.</p>
      </form>
    </Sheet>
  );
}
