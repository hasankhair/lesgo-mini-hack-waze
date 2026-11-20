import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import AuthLayout, { FormError, authErrorMessage } from './AuthLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

// Only allow redirects to in-app paths (prevents open redirects).
export const safeRedirect = (value) => (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/');

export default function LoginPage() {
  const { signIn, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const redirectTo = safeRedirect(location.state?.from);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to report incidents and save your places."
      footer={
        <>
          New to Lesgo?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormError message={error} />
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="mt-4 flex items-center justify-between">
          <label htmlFor="password" className="label mb-0">
            Password
          </label>
          <Link to="/forgot-password" className="text-xs text-brand-600 hover:underline dark:text-brand-400">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="input mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary mt-6 w-full py-3" disabled={busy || !isConfigured}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Sign in
        </button>
      </form>
    </AuthLayout>
  );
}
