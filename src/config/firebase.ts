// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import {
  getFirebaseClientConfig,
  resolveFirebaseRuntimeEnv,
  type FirebaseRuntimeEnv
} from "./firebaseEnvironment";

const runtimeHostname =
  typeof globalThis !== 'undefined' && 'location' in globalThis
    ? globalThis.location.hostname.toLowerCase()
    : '';

const isLocalRuntime =
  Boolean(import.meta.env.DEV) ||
  runtimeHostname === 'localhost' ||
  runtimeHostname === '127.0.0.1' ||
  runtimeHostname === '::1' ||
  runtimeHostname.endsWith('.local');

const requestedEnv = resolveFirebaseRuntimeEnv(import.meta.env.VITE_APP_ENV);

// Hard safety rule: local runtime must never use production Firebase.
export const activeFirebaseEnv: FirebaseRuntimeEnv = isLocalRuntime ? 'test' : requestedEnv;

// Firebase configuration selected by VITE_APP_ENV ('prod' | 'test')
export const firebaseConfig = getFirebaseClientConfig(activeFirebaseEnv, import.meta.env);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn("Firebase Analytics could not be initialized", error);
  }
}
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Messaging setup (will be fully implemented in a later phase, requiring notification permissions)
let messaging;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // FCM relies on a complete browser environment for push notifications
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn("Firebase Messaging could not be initialized", error);
  }
}

export { app, analytics, db, auth, storage, messaging };
