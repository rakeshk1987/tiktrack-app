import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AppChromeSignals() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
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

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-4">
      {!isOnline ? (
        <div className="pointer-events-auto w-full max-w-md rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-100 shadow-lg" role="status" aria-live="polite">
          Offline mode active. We will retry pending actions when network returns.
        </div>
      ) : null}
      {installEvent ? (
        <button
          type="button"
          onClick={handleInstall}
          className="pointer-events-auto min-h-[44px] rounded-xl border border-sky-300/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          Install TikTrack app
        </button>
      ) : null}
    </div>
  );
}
