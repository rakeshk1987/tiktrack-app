import { useCallback, useMemo, useState } from 'react';

interface QueuedMutation {
  id: string;
  label: string;
  retry: () => Promise<void>;
}

export function usePlannerMutationQueue() {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [queueMeta, setQueueMeta] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('planner_mutation_queue_meta_v1');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const persistMeta = useCallback((labels: string[]) => {
    setQueueMeta(labels);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('planner_mutation_queue_meta_v1', JSON.stringify(labels));
  }, []);

  const enqueue = useCallback((label: string, retry: () => Promise<void>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setQueue((prev) => [...prev, { id, label, retry }]);
    persistMeta([...queueMeta, label]);
    return id;
  }, [persistMeta, queueMeta]);

  const remove = useCallback((id: string) => {
    setQueue((prev) => {
      const next = prev.filter((item) => item.id !== id);
      persistMeta(next.map((item) => item.label));
      return next;
    });
  }, [persistMeta]);

  const retryOne = useCallback(async (id: string) => {
    const item = queue.find((entry) => entry.id === id);
    if (!item) return;
    await item.retry();
    remove(id);
  }, [queue, remove]);

  const hasQueued = useMemo(() => queue.length > 0 || queueMeta.length > 0, [queue.length, queueMeta.length]);

  return { queue, queueMeta, enqueue, remove, retryOne, hasQueued };
}
