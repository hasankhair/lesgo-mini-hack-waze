import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, History, LayoutDashboard, LogOut, Map as MapIcon, Megaphone, Settings, User } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { Avatar } from '../components/ProfileMenu.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import SavedPlaces from './dashboard/SavedPlaces.jsx';
import RecentTrips from './dashboard/RecentTrips.jsx';
import MyReports from './dashboard/MyReports.jsx';
import Overview from './dashboard/Overview.jsx';
import { ProfileSection, SettingsSection, useProfile } from './dashboard/AccountSettings.jsx';
import { PageHeader } from './dashboard/ui.jsx';

const TABS = [
  { id: 'overview', path: '/dashboard', label: 'Overview', short: 'Overview', icon: LayoutDashboard, title: 'Overview', description: 'Your trips, reports and places at a glance.' },
  { id: 'places', path: '/dashboard/places', label: 'Saved places', short: 'Places', icon: Bookmark, title: 'Saved places', description: 'Home, Work and favourite destinations for one-tap navigation.' },
  { id: 'history', path: '/dashboard/history', label: 'Recent destinations', short: 'Trips', icon: History, title: 'Recent destinations', description: 'Places you’ve navigated to.' },
  { id: 'reports', path: '/dashboard/reports', label: 'My reports', short: 'Reports', icon: Megaphone, title: 'My reports', description: 'Incidents you’ve shared with other drivers.' },
  { id: 'profile', path: '/dashboard/profile', label: 'Profile', short: 'Profile', icon: User, title: 'Profile', description: 'How you appear to other drivers.' },
  { id: 'settings', path: '/dashboard/settings', label: 'Settings', short: 'Settings', icon: Settings, title: 'Account settings', description: 'Appearance, privacy and security.' },
];

export default function DashboardPage() {
  const params = useParams();
  const tab = params.tab ?? 'overview';
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useProfile();

  const current = TABS.find((t) => t.id === tab);
  // Unknown tabs, and the explicit /dashboard/overview, go to /dashboard.
  if (!current || params.tab === 'overview') return <Navigate to="/dashboard" replace />;

  const name = profile?.username || user?.user_metadata?.username || user?.email || '';
  const doSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-dvh bg-canvas dark:bg-canvas-dark">
      {/* Sidebar (large screens) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r divider bg-white lg:flex dark:bg-navy-900">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <nav aria-label="Dashboard sections" className="flex-1 space-y-1 px-3 py-4">
          <p className="eyebrow px-3 pb-2">Menu</p>
          {TABS.map(({ id, path, label, icon: Icon }) => (
            <NavLink key={id} to={path} end className="nav-item">
              <Icon className="h-[18px] w-[18px]" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t divider p-4">
          <Link to="/" className="btn-primary w-full">
            <MapIcon className="h-4 w-4" aria-hidden /> Open map
          </Link>
          <div className="flex items-center gap-3 rounded-xl px-1 py-1">
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{profile?.username || 'Account'}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
            <button type="button" className="icon-btn h-9 w-9" aria-label="Sign out" title="Sign out" onClick={doSignOut}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar + tabs (small and medium screens) */}
      <header className="sticky top-0 z-20 border-b divider bg-white/95 backdrop-blur lg:hidden dark:bg-navy-900/95">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <Logo />
          <div className="flex items-center gap-1">
            <Link to="/" className="btn-secondary btn-sm">
              <MapIcon className="h-4 w-4" aria-hidden /> Map
            </Link>
            <button type="button" className="icon-btn" aria-label="Sign out" onClick={doSignOut}>
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav aria-label="Dashboard sections" className="-mb-px flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, path, short, icon: Icon }) => (
            <NavLink
              key={id}
              to={path}
              end
              className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:text-navy-900 aria-[current=page]:border-brand-600 aria-[current=page]:text-brand-700 dark:text-slate-300 dark:hover:text-white dark:aria-[current=page]:border-brand-400 dark:aria-[current=page]:text-brand-200"
            >
              <Icon className="h-4 w-4" aria-hidden /> {short}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <PageHeader
            title={tab === 'overview' ? `Welcome back${profile?.username ? `, ${profile.username}` : ''}` : current.title}
            description={current.description}
          />
          {tab === 'overview' && <Overview profile={profile} />}
          {tab === 'places' && <SavedPlaces />}
          {tab === 'history' && <RecentTrips />}
          {tab === 'reports' && <MyReports />}
          {tab === 'profile' && <ProfileSection profile={profile} setProfile={setProfile} />}
          {tab === 'settings' && <SettingsSection profile={profile} setProfile={setProfile} />}
        </div>
      </main>
    </div>
  );
}
