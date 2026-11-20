import { useEffect, useState } from 'react';
import { LoaderCircle, Monitor, Moon, Sun } from 'lucide-react';
import { getProfile, updateProfile } from '../../services/accountService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { formatDate } from '../../utils/format.js';
import { Avatar } from '../../components/ProfileMenu.jsx';
import { Card, Switch } from './ui.jsx';

// A labelled settings row: description on the left, control on the right.
function SettingRow({ title, description, children, htmlFor }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="font-medium text-navy-900 dark:text-white">
          {title}
        </label>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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

  if (!profile) {
    return (
      <div className="card p-6" role="status">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
            <div className="h-3 w-56 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
          </div>
        </div>
        <span className="sr-only">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card bodyClassName="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={profile.username} className="h-16 w-16 text-2xl" />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-navy-900 dark:text-white">{profile.username}</p>
            <p className="truncate text-sm text-muted">{profile.email}</p>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Member since {formatDate(profile.created_at)}</p>
          </div>
        </div>
      </Card>

      <Card title="Public name" description="Shown on new reports you submit.">
        <form onSubmit={save} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="username" className="label">
              Username
            </label>
            <input id="username" className="input" value={username} maxLength={30} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary h-11" disabled={saving || username.trim() === profile.username}>
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save changes
          </button>
        </form>
        <p className="hint">3–30 characters: letters, numbers, dots, dashes or underscores.</p>
      </Card>
    </div>
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
      notify(value ? 'Trips will be saved.' : 'New trips won’t be saved.', 'success');
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
    <div className="space-y-6">
      <Card title="Appearance">
        <SettingRow title="Theme" description="Match your device, or choose light or dark.">
          <div role="radiogroup" aria-label="Theme" className="segmented">
            {[
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
              ['system', 'System', Monitor],
            ].map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => setTheme(value)} className="segment">
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </SettingRow>
      </Card>

      <Card title="Privacy">
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          <SettingRow title="Save my navigation history" description="Used for recent destinations. Turn off to stop recording new trips." htmlFor="save-history">
            <Switch id="save-history" label="Save my navigation history" checked={profile?.save_history ?? true} disabled={!profile} onChange={toggleHistory} />
          </SettingRow>
          <div className="py-4 last:pb-0">
            <p className="text-sm text-muted">
              Location is used only while the app is open and you allow it. Continuous tracking stops when navigation ends.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Security">
        <form onSubmit={changePassword} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="new-password" className="label">
              Change password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
            />
          </div>
          <button type="submit" className="btn-secondary h-11" disabled={busy || !password}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Update password
          </button>
        </form>
        <p className="hint">At least 8 characters.</p>
      </Card>
    </div>
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
