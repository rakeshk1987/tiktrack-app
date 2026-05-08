import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getSecondaryAuth } from './secondaryAuth';

export async function createOrReuseChildAccount(
  email: string,
  password: string
): Promise<{ uid: string; wasExisting: boolean }> {
  const secondaryAuth = getSecondaryAuth();

  try {
    const created = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return { uid: created.user.uid, wasExisting: false };
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code !== 'auth/email-already-in-use') {
      throw error;
    }

    const existing = await signInWithEmailAndPassword(secondaryAuth, email, password);
    return { uid: existing.user.uid, wasExisting: true };
  } finally {
    if (secondaryAuth.currentUser) {
      await signOut(secondaryAuth);
    }
  }
}
