import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crosshair, LoaderCircle, LocateFixed } from 'lucide-react';
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
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Sign in to share road conditions with other drivers. You can browse reports without an account.
        </p>
        <div className="mt-5 flex gap-3">
          <Link to="/login" state={{ from: '/' }} className="btn-primary flex-1">
            Sign in
          </Link>
          <Link to="/register" className="btn-secondary flex-1">
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
    <Sheet title="Report an incident" onClose={onClose}>
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
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-1 py-3 text-xs font-medium transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15'
                      : 'border-transparent bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: color }}>
                    <Icon className="h-5 w-5 text-white" aria-hidden />
                  </span>
                  <span className="text-center leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="label">Location</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={where === 'gps'}
              disabled={!userPosition}
              onClick={() => setWhere('gps')}
              className={`btn ${where === 'gps' ? 'bg-brand-600 text-white' : 'btn-secondary'}`}
            >
              <LocateFixed className="h-4 w-4" aria-hidden /> My location
            </button>
            <button
              type="button"
              aria-pressed={where === 'center'}
              onClick={() => setWhere('center')}
              className={`btn ${where === 'center' ? 'bg-brand-600 text-white' : 'btn-secondary'}`}
            >
              <Crosshair className="h-4 w-4" aria-hidden /> Map centre
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {location ? formatCoords(location.lat, location.lng) : 'No location yet'}
            {!userPosition && ' · GPS not available, using the map centre'}
          </p>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="report-description" className="label">
            Details <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="report-description"
            className="input min-h-20 resize-none"
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Left lane blocked"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {description.length}/{MAX_DESCRIPTION}
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
          Submit report
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">Reports are public and expire automatically. Please report only when safe.</p>
      </form>
    </Sheet>
  );
}
