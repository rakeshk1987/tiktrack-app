import { firebaseConfig } from '../config/firebase';

interface ChildAuthResponse {
  localId: string;
}

interface FirebaseRestError {
  error?: {
    message?: string;
  };
}

function getIdentityToolkitUrl(path: string) {
  if (!firebaseConfig?.apiKey) {
    throw new Error('Firebase API key is unavailable for child account creation.');
  }

  return `https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${firebaseConfig.apiKey}`;
}

async function postAuthRequest(path: string, email: string, password: string): Promise<ChildAuthResponse> {
  const response = await fetch(getIdentityToolkitUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true
    })
  });

  const payload = (await response.json()) as ChildAuthResponse & FirebaseRestError;
  if (!response.ok || !payload.localId) {
    const errorMessage = payload.error?.message || 'UNKNOWN_ERROR';
    const error = new Error(errorMessage) as Error & { code?: string };
    error.code = `auth/${errorMessage.toLowerCase().replace(/_/g, '-')}`;
    throw error;
  }

  return payload;
}

export async function createOrReuseChildAccount(email: string, password: string): Promise<{ uid: string }> {
  try {
    const created = await postAuthRequest('signUp', email, password);
    return { uid: created.localId };
  } catch (error) {
    const err = error as Error & { code?: string; message?: string };
    if (err.code !== 'auth/email-exists') {
      throw error;
    }

    const existing = await postAuthRequest('signInWithPassword', email, password);
    return { uid: existing.localId };
  }
}
