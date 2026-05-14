interface PlannerOfflineBannerProps {
  isOnline: boolean;
  hasQueuedMutations?: boolean;
  onRetryQueued?: () => void;
}

export function PlannerOfflineBanner({ isOnline, hasQueuedMutations = false, onRetryQueued }: PlannerOfflineBannerProps) {
  if (isOnline && !hasQueuedMutations) return null;

  return (
    <div className="rounded-2xl border border-sky-300/25 bg-sky-500/12 px-4 py-3 text-sm text-sky-100" role="status" aria-live="polite">
      {!isOnline ? <p>Offline mode active. Changes may be queued locally.</p> : null}
      {hasQueuedMutations ? (
        <button type="button" onClick={onRetryQueued} className="mt-2 min-h-[40px] rounded-lg border border-sky-200/35 px-3 text-xs font-semibold">
          Retry queued actions
        </button>
      ) : null}
    </div>
  );
}
