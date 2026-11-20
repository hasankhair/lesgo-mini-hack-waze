import { Link } from 'react-router-dom';
import { LogoMark } from '../components/Logo.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AuthLayout({ title, subtitle, children, footer }) {
  const { isConfigured } = useAuth();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-4 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2" aria-label="Back to map">
          <LogoMark className="h-11 w-11" />
          <span className="text-2xl font-extrabold tracking-tight">
            Les<span className="text-brand-600 dark:text-brand-400">go</span>
          </span>
        </Link>
        <div className="panel p-6 sm:p-8">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          {!isConfigured && (
            <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Accounts are disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</div>}
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-brand-600 hover:underline dark:text-brand-400">
            ← Back to the map
          </Link>
        </p>
      </div>
    </main>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
      {message}
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
