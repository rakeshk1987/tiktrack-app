interface ParentSyncStatusProps {
  status: 'not_connected' | 'connected' | 'token_expired' | 'error';
}

export function ParentSyncStatus({ status }: ParentSyncStatusProps) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">Google sync: {status}</section>;
}
