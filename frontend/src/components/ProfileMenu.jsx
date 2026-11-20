import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function ProfileMenu() {
  const { user, signOut } = useAuth();
  const { resolved, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const initial = (user?.user_metadata?.username || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className="panel flex h-12 w-12 items-center justify-center rounded-full font-semibold"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? 'Account menu' : 'Sign in or change settings'}
      >
        {user ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white">{initial}</span>
        ) : (
          <User className="h-5 w-5" />
        )}
      </button>
      {open && (
        <div role="menu" className="panel absolute top-14 right-0 z-[1200] w-60 animate-fade-in py-2">
          {user ? (
            <>
              <p className="truncate px-4 pb-2 text-xs text-slate-500">{user.email}</p>
              <Link role="menuitem" to="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setOpen(false)}>
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link role="menuitem" to="/login" className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setOpen(false)}>
                <User className="h-4 w-4" /> Sign in
              </Link>
              <Link role="menuitem" to="/register" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setOpen(false)}>
                Create account
              </Link>
            </>
          )}
          <button role="menuitem" type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/10" onClick={toggle}>
            {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {user && (
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-white/10"
              onClick={async () => {
                setOpen(false);
                await signOut();
                navigate('/');
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
