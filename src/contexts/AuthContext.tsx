import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/schema';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { inferRoleFromEmail, isOfflineLikeAuthError } from '../utils/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Using a placeholder mock until we attach proper Firestore mapping
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const PROFILE_FETCH_TIMEOUT_MS = 2500;

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('profile-fetch-timeout')), timeoutMs);
      });

      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId!);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true); // Prevent instant redirect
        try {
          const fallbackUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: inferRoleFromEmail(firebaseUser.email || '')
          };

          const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
          if (isOffline) {
            setUser(fallbackUser);
          } else {
            const userDoc = await withTimeout(
              getDoc(doc(db, 'users', firebaseUser.uid)),
              PROFILE_FETCH_TIMEOUT_MS
            );
            if (userDoc.exists()) {
              const data = userDoc.data();
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: data.role ?? fallbackUser.role,
                parent_id: data.parent_id,
                linked_family_id: data.linked_family_id
              });
            } else {
              // Safeguard fallback if document creation lagged.
              setUser(fallbackUser);
            }
          }
        } catch (error) {
           // Keep authenticated users signed in even if Firestore profile read fails.
           const offline = isOfflineLikeAuthError(error);
           const logger = offline ? console.warn : console.error;
           logger("Auth profile fetch failed; using auth fallback:", error);
           setUser({
             id: firebaseUser.uid,
             email: firebaseUser.email || '',
             role: inferRoleFromEmail(firebaseUser.email || '')
           });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
