import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import AuthLayout, { FormError, authErrorMessage } from './AuthLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

// Reached from the password-reset email. Supabase signs the user in with a
// short-lived recovery session, which allows setting a new password.
export default function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && !session) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is invalid or has expired.">
        <Link to="/forgot-password" className="btn-primary w-full">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      notify('Your password was updated.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
    return undefined;
  };

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} noValidate>
        <FormError message={error} />
        <label htmlFor="password" className="label">
          New password
        </label>
        <input id="password" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label htmlFor="confirm" className="label mt-4">
          Confirm new password
        </label>
        <input id="confirm" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" className="btn-primary mt-6 w-full py-3" disabled={busy || loading}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Update password
        </button>
      </form>
    </AuthLayout>
  );
}
