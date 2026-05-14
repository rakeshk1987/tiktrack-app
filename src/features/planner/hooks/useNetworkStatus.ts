import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    function goOnline() { setIsOnline(true); }
    function goOffline() { setIsOnline(false); }

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline };
}
