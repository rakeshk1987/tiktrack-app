// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import type { Analytics } from "firebase/analytics";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";
import {
  getFirebaseClientConfig,
  resolveFirebaseRuntimeEnv,
  type FirebaseClientConfig,
  type FirebaseRuntimeEnv
} from "./firebaseEnvironment";

const runtimeHostname =
  typeof globalThis !== 'undefined' && 'location' in globalThis
    ? globalThis.location.hostname.toLowerCase()
    : '';
const emulatorHost = runtimeHostname || '127.0.0.1';

const isLocalRuntime =
  Boolean(import.meta.env.DEV) ||
  runtimeHostname === 'localhost' ||
  runtimeHostname === '127.0.0.1' ||
  runtimeHostname === '::1' ||
  runtimeHostname.endsWith('.local');

const allowProdOnLocal =
  String(import.meta.env.VITE_ALLOW_PROD_ON_LOCAL ?? '').toLowerCase() === 'true';

const requestedEnv = resolveFirebaseRuntimeEnv(import.meta.env.VITE_APP_ENV);
export const activeFirebaseEnv: FirebaseRuntimeEnv = requestedEnv;
const emulatorPreference = (import.meta.env.VITE_USE_FIREBASE_EMULATORS ?? '').toLowerCase();
export const isUsingFirebaseEmulators =
  isLocalRuntime && emulatorPreference !== 'false';

let firebaseConfig: FirebaseClientConfig | null = null;
let firebaseInitError = '';

try {
  if (isLocalRuntime && !isUsingFirebaseEmulators && !allowProdOnLocal) {
    throw new Error(
      'Safety stop: localhost is attempting to use production Firebase. Run `npm run local` (recommended), set VITE_USE_FIREBASE_EMULATORS=true, or explicitly opt in with VITE_ALLOW_PROD_ON_LOCAL=true.'
    );
  }

  const configEnv: FirebaseRuntimeEnv = isUsingFirebaseEmulators ? 'prod' : activeFirebaseEnv;
  firebaseConfig = getFirebaseClientConfig(configEnv, import.meta.env);
} catch (error) {
  firebaseInitError =
    error instanceof Error ? error.message : 'Firebase configuration could not be loaded.';
}

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
let analytics: Analytics | null = null;
if (app && typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn("Firebase Analytics could not be initialized", error);
  }
}
const dbInstance = app ? getFirestore(app) : null;
const authInstance = app ? getAuth(app) : null;
const storageInstance = app ? getStorage(app) : null;

if (isUsingFirebaseEmulators && authInstance && dbInstance && storageInstance) {
  connectAuthEmulator(authInstance, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(dbInstance, emulatorHost, 8080);
  connectStorageEmulator(storageInstance, emulatorHost, 9199);
}

// Messaging setup (will be fully implemented in a later phase, requiring notification permissions)
let messaging: Messaging | null = null;
if (!isUsingFirebaseEmulators && app && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // FCM relies on a complete browser environment for push notifications
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn("Firebase Messaging could not be initialized", error);
  }
}

const db = dbInstance as Firestore;
const auth = authInstance as Auth;
const storage = storageInstance as FirebaseStorage;

if (typeof window !== 'undefined') {
  (window as any).firebase_db = db;
  (window as any).firebase_auth = auth;
}

export { app, analytics, auth, db, firebaseConfig, firebaseInitError, storage, messaging };
