import { useEffect } from 'react';

export function useUnsavedChangesGuard(active: boolean, message = 'You have unsaved changes. Leave anyway?') {
  useEffect(() => {
    if (!active) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [active, message]);
}
