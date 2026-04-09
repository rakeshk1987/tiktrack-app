import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "../config/firebase";

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
    
  return getAuth(secondaryApp);
}
