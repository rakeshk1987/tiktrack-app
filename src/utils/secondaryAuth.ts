import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, inMemoryPersistence, initializeAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { firebaseConfig, isUsingFirebaseEmulators } from "../config/firebase";

let secondaryAuthEmulatorConnected = false;
let secondaryAuthInstance: Auth | null = null;
const runtimeHostname =
  typeof globalThis !== 'undefined' && 'location' in globalThis
    ? globalThis.location.hostname
    : '127.0.0.1';

// This creates a secondary Firebase instance specifically for creating child accounts.
// Without it, calling createUserWithEmailAndPassword on the primary `auth` instance
// would automatically sign the Parent out of their session.
export function getSecondaryAuth() {
  const secondaryAppName = "SecondaryAppForChildCreation";
  if (!firebaseConfig) {
    throw new Error('Firebase is not configured for local child account management yet.');
  }
  
  // Check if it's already generated to prevent duplication errors
  const secondaryApp = getApps().find(app => app.name === secondaryAppName) 
    || initializeApp(firebaseConfig, secondaryAppName);

  if (!secondaryAuthInstance) {
    secondaryAuthInstance = initializeAuth(secondaryApp, {
      persistence: inMemoryPersistence
    });
  }

  const secondaryAuth = secondaryAuthInstance;

  if (isUsingFirebaseEmulators && !secondaryAuthEmulatorConnected) {
    connectAuthEmulator(secondaryAuth, `http://${runtimeHostname}:9099`, { disableWarnings: true });
    secondaryAuthEmulatorConnected = true;
  }

  return secondaryAuth;
}
