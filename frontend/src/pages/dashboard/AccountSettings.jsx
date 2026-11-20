import { useEffect, useState } from 'react';
import { LoaderCircle, Monitor, Moon, Sun } from 'lucide-react';
import { getProfile, updateProfile } from '../../services/accountService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { formatDate } from '../../utils/format.js';

export function ProfileSection({ profile, setProfile }) {
  const { notify } = useToast();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => setUsername(profile?.username ?? ''), [profile?.username]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      setProfile(await updateProfile({ username: username.trim() }));
      notify('Profile updated.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <p className="text-sm text-slate-500">Loading profile…</p>;

  return (
    <section aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="text-lg font-semibold">
        Profile
      </h2>
      <div className="mt-4 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
          {profile.username.charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="text-lg font-semibold">{profile.username}</p>
          <p className="text-sm text-slate-500">{profile.email}</p>
          <p className="text-xs text-slate-400">Member since {formatDate(profile.created_at)}</p>
        </div>
      </div>
      <form onSubmit={save} className="mt-6 max-w-sm">
        <label htmlFor="username" className="label">
          Username
        </label>
        <div className="flex gap-2">
          <input id="username" className="input" value={username} maxLength={30} onChange={(e) => setUsername(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={saving || username.trim() === profile.username}>
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Shown on new reports you submit.</p>
      </form>
    </section>
  );
}

export function SettingsSection({ profile, setProfile }) {
  const { updatePassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const { notify } = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleHistory = async (value) => {
    try {
      setProfile(await updateProfile({ save_history: value }));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      notify('Password must be at least 8 characters.', 'error');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setPassword('');
      notify('Password changed.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="settings-heading" className="space-y-8">
      <h2 id="settings-heading" className="text-lg font-semibold">
        Account settings
      </h2>

      <div>
        <p className="label">Appearance</p>
        <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-white/10">
          {[
            ['light', 'Light', Sun],
            ['dark', 'Dark', Moon],
            ['system', 'System', Monitor],
          ].map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${theme === value ? 'bg-white shadow dark:bg-navy-700' : ''}`}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">Privacy</p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-brand-600"
            checked={profile?.save_history ?? true}
            disabled={!profile}
            onChange={(e) => toggleHistory(e.target.checked)}
          />
          <span>
            Save my navigation history
            <span className="block text-xs text-slate-500">Used for recent destinations. Turn off to stop recording new trips.</span>
          </span>
        </label>
        <p className="mt-3 text-xs text-slate-500">
          Location is used only while the app is open and you allow it. Continuous tracking stops when navigation ends.
        </p>
      </div>

      <form onSubmit={changePassword} className="max-w-sm">
        <label htmlFor="new-password" className="label">
          Change password
        </label>
        <div className="flex gap-2">
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
          />
          <button type="submit" className="btn-secondary" disabled={busy || !password}>
            Update
          </button>
        </div>
      </form>
    </section>
  );
}

export function useProfile() {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);
  return [profile, setProfile];
}
