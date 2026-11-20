import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle, Mail } from 'lucide-react';
import AuthLayout, { FormError, authErrorMessage } from './AuthLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration({ username, email, password, confirm }) {
  if (!USERNAME_RE.test(username)) return 'Username must be 3–30 characters: letters, numbers, dots, dashes or underscores.';
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export default function RegisterPage() {
  const { signUp, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const values = { ...form, username: form.username.trim(), email: form.email.trim() };
    const problem = validateRegistration(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp(values);
      if (needsConfirmation) setSentTo(values.email);
      else navigate('/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your email">
        <div className="flex items-start gap-3">
          <Mail className="h-6 w-6 shrink-0 text-brand-600" aria-hidden />
          <p className="text-sm">
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your account, then sign in.
          </p>
        </div>
        <Link to="/login" className="btn-primary btn-lg mt-6 w-full">
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join drivers sharing real-time road conditions."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormError message={error} />
        <label htmlFor="username" className="label">
          Username <span className="font-normal text-slate-500">(shown on your reports)</span>
        </label>
        <input id="username" autoComplete="username" className="input" value={form.username} onChange={set('username')} maxLength={30} />
        <label htmlFor="email" className="label mt-5">
          Email
        </label>
        <input id="email" type="email" autoComplete="email" className="input" value={form.email} onChange={set('email')} />
        <label htmlFor="password" className="label mt-5">
          Password
        </label>
        <input id="password" type="password" autoComplete="new-password" className="input" value={form.password} onChange={set('password')} />
        <label htmlFor="confirm" className="label mt-5">
          Confirm password
        </label>
        <input id="confirm" type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} />
        <button type="submit" className="btn-primary btn-lg mt-6 w-full" disabled={busy || !isConfigured}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Create account
        </button>
        <p className="hint mt-4 leading-relaxed">
          We store only your email, username and the data you choose to save. Your location is never stored unless you submit a report or save a place.
        </p>
      </form>
    </AuthLayout>
  );
}
