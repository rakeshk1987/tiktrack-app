import { usePlannerToast } from '../../hooks/usePlannerToast';

const tone: Record<string, string> = {
  success: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-300/30 bg-rose-500/15 text-rose-100',
  retry: 'border-amber-300/30 bg-amber-500/15 text-amber-100',
  offline: 'border-sky-300/30 bg-sky-500/15 text-sky-100'
};

export function PlannerToastViewport() {
  const { toasts, dismissToast } = usePlannerToast();

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-lg ${tone[toast.type]}`}>
          <p>{toast.message}</p>
          <div className="mt-2 flex gap-2">
            {toast.onAction ? <button type="button" onClick={toast.onAction} className="min-h-[36px] rounded-lg border border-white/25 px-2 text-xs font-semibold">{toast.actionLabel || 'Retry'}</button> : null}
            <button type="button" onClick={() => dismissToast(toast.id)} className="min-h-[36px] rounded-lg border border-white/25 px-2 text-xs">Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}
