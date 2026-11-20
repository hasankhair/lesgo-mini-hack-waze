import { Link } from 'react-router-dom';
import { ArrowLeft, BellRing, CircleAlert, Route, ShieldCheck } from 'lucide-react';
import { LogoMark } from '../components/Logo.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const HIGHLIGHTS = [
  { icon: Route, title: 'Live traffic routing', text: 'Routes and arrival times that account for current traffic.' },
  { icon: BellRing, title: 'Alerts on your route', text: 'Spoken warnings about accidents, closures and hazards ahead.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Your location is only used while you allow it.' },
];

function Wordmark({ className = '' }) {
  return (
    <span className={`text-2xl font-extrabold tracking-tight ${className}`}>
      Les<span className="text-brand-500">go</span>
    </span>
  );
}

// Split layout on large screens: brand panel on the left, form on the right.
// Single centred column on small screens.
export default function AuthLayout({ title, subtitle, children, footer }) {
  const { isConfigured } = useAuth();
  return (
    <div className="flex min-h-dvh bg-canvas dark:bg-canvas-dark">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(60% 50% at 20% 10%, rgb(37 99 235 / 0.45), transparent), radial-gradient(50% 40% at 90% 90%, rgb(34 197 94 / 0.25), transparent)' }}
          aria-hidden
        />
        <Link to="/" className="relative flex items-center gap-3" aria-label="Back to map">
          <span className="flex h-12 items-center rounded-2xl bg-white px-2 shadow-sm">
            <LogoMark className="h-10" />
          </span>
          <Wordmark className="text-white" />
        </Link>
        <div className="relative">
          <h2 className="max-w-sm text-3xl leading-tight font-semibold text-white">Drive smarter with your community.</h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-brand-300" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">Traffic data © TomTom · Map data © OpenStreetMap contributors</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[25rem]">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden" aria-label="Back to map">
            <LogoMark className="h-14" />
            <Wordmark className="text-navy-900 dark:text-white" />
          </Link>

          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
          {!isConfigured && (
            <p role="alert" className="alert-warning mt-5">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Accounts are disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.
            </p>
          )}
          <div className="card mt-6 p-6 sm:p-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
          <p className="mt-4 text-center">
            <Link to="/" className="btn-ghost btn-sm text-slate-600 dark:text-slate-300">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the map
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="alert-error mb-5">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

// Supabase error messages are fine to show, but normalise the common ones.
export function authErrorMessage(err) {
  const msg = err?.message || '';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email address first. Check your inbox.';
  if (/already registered/i.test(msg)) return 'An account with this email already exists.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.';
  return msg || 'Something went wrong. Please try again.';
}
