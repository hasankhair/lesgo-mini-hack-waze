import { useEffect, useState } from 'react';

// Keeps the screen on while `active` is true, using the Screen Wake Lock API.
// Browsers release the lock when the tab is hidden, so it is re-acquired when
// the page becomes visible again. Does nothing where unsupported.
export function useWakeLock(active, { wakeLock = typeof navigator !== 'undefined' ? navigator.wakeLock : undefined } = {}) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !wakeLock?.request) return undefined;
    let sentinel = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) {
          next.release();
          return;
        }
        sentinel = next;
        setHeld(true);
        sentinel.addEventListener?.('release', () => {
          sentinel = null;
          setHeld(false);
        });
      } catch {
        // Denied (e.g. battery saver). Navigation still works.
        setHeld(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release();
      sentinel = null;
      setHeld(false);
    };
  }, [active, wakeLock]);

  return { supported: Boolean(wakeLock?.request), held };
}
