import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import AuthLayout, { FormError, authErrorMessage } from './AuthLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ForgotPasswordPage() {
  const { sendPasswordReset, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new password."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="text-sm">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <FormError message={error} />
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn-primary btn-lg mt-6 w-full" disabled={busy || !isConfigured}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Send reset link
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
