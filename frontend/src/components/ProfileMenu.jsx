import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogIn, LogOut, Moon, Sun, User, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

export function Avatar({ name, className = 'h-9 w-9 text-sm' }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white ${className}`} aria-hidden>
      {initial}
    </span>
  );
}

export default function ProfileMenu() {
  const { user, signOut } = useAuth();
  const { resolved, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = user?.user_metadata?.username || user?.email || '';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className="panel flex h-12 w-12 items-center justify-center rounded-full transition hover:border-slate-300 dark:hover:border-white/20"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? 'Account menu' : 'Sign in or change settings'}
      >
        {user ? <Avatar name={name} /> : <User className="h-5 w-5 text-slate-700 dark:text-slate-200" />}
      </button>
      {open && (
        <div role="menu" className="panel absolute top-14 right-0 z-[1200] w-64 animate-fade-in p-1.5 shadow-overlay">
          {user ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{user.user_metadata?.username || 'Signed in'}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
              </div>
              <div className="my-1 border-t divider" />
              <Link role="menuitem" to="/dashboard" className="menu-item" onClick={() => setOpen(false)}>
                <LayoutDashboard className="h-4 w-4 text-slate-500" /> Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link role="menuitem" to="/login" className="menu-item" onClick={() => setOpen(false)}>
                <LogIn className="h-4 w-4 text-slate-500" /> Sign in
              </Link>
              <Link role="menuitem" to="/register" className="menu-item" onClick={() => setOpen(false)}>
                <UserPlus className="h-4 w-4 text-slate-500" /> Create account
              </Link>
            </>
          )}
          <button role="menuitem" type="button" className="menu-item" onClick={toggle}>
            {resolved === 'dark' ? <Sun className="h-4 w-4 text-slate-500" /> : <Moon className="h-4 w-4 text-slate-500" />}
            {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {user && (
            <>
              <div className="my-1 border-t divider" />
              <button
                role="menuitem"
                type="button"
                className="menu-item text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                  navigate('/');
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
