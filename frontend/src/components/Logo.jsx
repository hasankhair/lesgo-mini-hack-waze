import { Link } from 'react-router-dom';

// The logo image is 1455×1048 (about 1.39:1). Size it by height; width follows.
export function LogoMark({ className = 'h-10' }) {
  return <img src="/logo.png" alt="" aria-hidden="true" width="139" height="100" className={`${className} w-auto select-none`} draggable="false" />;
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
