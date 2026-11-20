import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="rp-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <path d="M32 4C20.4 4 11 13.2 11 24.6 11 40 32 60 32 60s21-20 21-35.4C53 13.2 43.6 4 32 4z" fill="url(#rp-logo)" />
      <path d="M17 26h8l4-8 6 16 4-8h8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ compact = false }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Lesgo home">
      <LogoMark />
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight text-navy-900 dark:text-white">
          Les<span className="text-brand-600 dark:text-brand-400">go</span>
        </span>
      )}
    </Link>
  );
}
