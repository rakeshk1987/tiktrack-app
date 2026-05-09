import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getSecondaryAuth } from './secondaryAuth';

async function withAuthNetworkRetry<T>(op: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await op();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const isNetworkLike = code === 'auth/network-request-failed' || code === 'auth/internal-error';
      if (!isNetworkLike || i === attempts - 1) {
        throw error;
      }
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
    }
  }
  throw lastError;
}

export async function createOrReuseChildAccount(
  email: string,
  password: string
): Promise<{ uid: string; wasExisting: boolean }> {
  const secondaryAuth = getSecondaryAuth();

  try {
    const created = await withAuthNetworkRetry(() =>
      createUserWithEmailAndPassword(secondaryAuth, email, password)
    );
    return { uid: created.user.uid, wasExisting: false };
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code !== 'auth/email-already-in-use') {
      throw error;
    }

    const existing = await withAuthNetworkRetry(() =>
      signInWithEmailAndPassword(secondaryAuth, email, password)
    );
    return { uid: existing.user.uid, wasExisting: true };
  } finally {
    if (secondaryAuth.currentUser) {
      await signOut(secondaryAuth);
    }
  }
}
