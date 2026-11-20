import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, History, LogOut, Map as MapIcon, Megaphone, Settings, User } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import SavedPlaces from './dashboard/SavedPlaces.jsx';
import RecentTrips from './dashboard/RecentTrips.jsx';
import MyReports from './dashboard/MyReports.jsx';
import { ProfileSection, SettingsSection, useProfile } from './dashboard/AccountSettings.jsx';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'places', label: 'Saved places', icon: Bookmark },
  { id: 'history', label: 'Recent destinations', icon: History },
  { id: 'reports', label: 'My reports', icon: Megaphone },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function DashboardPage() {
  const { tab = 'profile' } = useParams();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useProfile();

  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-navy-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-navy-900/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <NavLink to="/" className="btn-secondary py-2">
              <MapIcon className="h-4 w-4" aria-hidden /> Map
            </NavLink>
            <button
              type="button"
              className="icon-btn"
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Dashboard sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <NavLink
              key={id}
              to={id === 'profile' ? '/dashboard' : `/dashboard/${id}`}
              end
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-white/5'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>

        <main className="panel min-w-0 p-5 sm:p-6">
          {tab === 'profile' && <ProfileSection profile={profile} setProfile={setProfile} />}
          {tab === 'places' && <SavedPlaces />}
          {tab === 'history' && <RecentTrips />}
          {tab === 'reports' && <MyReports />}
          {tab === 'settings' && <SettingsSection profile={profile} setProfile={setProfile} />}
        </main>
      </div>
    </div>
  );
}
