import { useEffect, useState } from 'react';

export function AppChromeSignals() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-4">
      {!isOnline ? (
        <div className="pointer-events-auto w-full max-w-md rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-100 shadow-lg" role="status" aria-live="polite">
          Offline mode active. We will retry pending actions when network returns.
        </div>
      ) : null}
    </div>
  );
}
