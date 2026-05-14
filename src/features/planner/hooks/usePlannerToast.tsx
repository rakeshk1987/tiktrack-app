import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type PlannerToastType = 'success' | 'error' | 'retry' | 'offline';

interface PlannerToast {
  id: string;
  type: PlannerToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface PlannerToastContextValue {
  toasts: PlannerToast[];
  pushToast: (toast: Omit<PlannerToast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const PlannerToastContext = createContext<PlannerToastContextValue | null>(null);

export function PlannerToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<PlannerToast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<PlannerToast, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, toast.type === 'error' ? 5500 : 3800);
  }, []);

  const value = useMemo(() => ({ toasts, pushToast, dismissToast }), [dismissToast, pushToast, toasts]);

  return (
    <PlannerToastContext.Provider value={value}>
      {children}
    </PlannerToastContext.Provider>
  );
}

export function usePlannerToast() {
  const ctx = useContext(PlannerToastContext);
  if (!ctx) throw new Error('usePlannerToast must be used within PlannerToastProvider');
  return ctx;
}
