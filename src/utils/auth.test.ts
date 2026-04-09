import { describe, expect, it } from 'vitest';
import { inferRoleFromEmail, isOfflineLikeAuthError } from './auth';

describe('inferRoleFromEmail', () => {
  it('returns child_user for internal child domain', () => {
    expect(inferRoleFromEmail('kid@tiktrack.family')).toBe('child_user');
  });

  it('is case-insensitive for child domain', () => {
    expect(inferRoleFromEmail('KID@TIKTRACK.FAMILY')).toBe('child_user');
  });

  it('returns parent_admin for non-child domain', () => {
    expect(inferRoleFromEmail('parent@gmail.com')).toBe('parent_admin');
  });

  it('returns parent_admin for empty email', () => {
    expect(inferRoleFromEmail('')).toBe('parent_admin');
  });
});

describe('isOfflineLikeAuthError', () => {
  it('returns true for firestore unavailable code', () => {
    expect(isOfflineLikeAuthError({ code: 'unavailable' })).toBe(true);
  });

  it('returns true for timeout message', () => {
    expect(isOfflineLikeAuthError({ message: 'profile-fetch-timeout' })).toBe(true);
  });

  it('returns true for failed-precondition code', () => {
    expect(isOfflineLikeAuthError({ code: 'failed-precondition' })).toBe(true);
  });

  it('returns true when message includes offline', () => {
    expect(isOfflineLikeAuthError({ message: 'client is offline' })).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isOfflineLikeAuthError({ code: 'permission-denied' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isOfflineLikeAuthError(null)).toBe(false);
  });
});
