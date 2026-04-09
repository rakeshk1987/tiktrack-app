import type { Role } from '../types/schema';

export function inferRoleFromEmail(email: string): Role {
  return email.toLowerCase().endsWith('@tiktrack.family') ? 'child_user' : 'parent_admin';
}

export function isOfflineLikeAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { code?: string; message?: string };
  const message = (err.message || '').toLowerCase();

  return (
    err.code === 'unavailable' ||
    err.code === 'failed-precondition' ||
    message.includes('timeout') ||
    message.includes('offline')
  );
}
