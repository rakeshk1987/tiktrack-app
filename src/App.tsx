import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './ErrorBoundary';
import { activeFirebaseEnv, firebaseInitError, isUsingFirebaseEmulators } from './config/firebase';

const ChildHome = lazy(() => import('./pages/child/Dashboard'));
const ChildLayout = lazy(() => import('./pages/child/ChildLayout'));
const ChildQuests = lazy(() => import('./pages/child/Quests'));
const ChildDiary = lazy(() => import('./pages/child/Diary'));
const ChildProfile = lazy(() => import('./pages/child/Profile'));
const ParentDashboard = lazy(() => import('./pages/parent/Dashboard'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));

function FirebaseConfigScreen() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-[0_24px_70px_rgba(30,34,53,0.14)] backdrop-blur-md">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-amber-600">Firebase setup needed</p>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">TikTrack could not load its Firebase configuration</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">Hosted environments can still override Firebase credentials with `.env` values, but local development now uses Firebase emulators automatically.</p>
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">{firebaseInitError}</div>
          <div className="mt-6 rounded-2xl bg-slate-950 px-5 py-5 text-sm text-slate-100">
            <p className="font-bold text-white">Optional hosted override values</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-300">{`VITE_APP_ENV=prod
VITE_FIREBASE_PROD_API_KEY=
VITE_FIREBASE_PROD_AUTH_DOMAIN=
VITE_FIREBASE_PROD_PROJECT_ID=
VITE_FIREBASE_PROD_STORAGE_BUCKET=
VITE_FIREBASE_PROD_MESSAGING_SENDER_ID=
VITE_FIREBASE_PROD_APP_ID=
VITE_FIREBASE_PROD_MEASUREMENT_ID=`}</pre>
          </div>
          <p className="mt-5 text-sm text-slate-500">Runtime mode: <span className="font-bold uppercase">{isUsingFirebaseEmulators ? 'local emulator' : activeFirebaseEnv}</span></p>
        </div>
      </div>
    </div>
  );
}

function RouteLoader() {
  return <div className="h-screen w-screen flex items-center justify-center text-sm font-bold text-slate-500">Loading screen...</div>;
}

function PrivateRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'child_user' | 'parent_admin' }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading Data...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'child_user') return <Navigate to="/child" />;
    return <Navigate to="/parent" />;
  }
  return <>{children}</>;
}

function WelcomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50"><p className="text-gray-500 font-bold animate-pulse">Authenticating...</p></div>;
  if (!user) return <Navigate to="/login" />;
  return user.role === 'child_user' ? <Navigate to="/child" /> : <Navigate to="/parent" />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/child"
          element={
            <PrivateRoute requiredRole="child_user">
              <ChildLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<ChildHome />} />
          <Route path="quests" element={<ChildQuests />} />
          <Route path="diary" element={<ChildDiary />} />
          <Route path="profile" element={<ChildProfile />} />
        </Route>
        <Route
          path="/parent"
          element={
            <PrivateRoute requiredRole="parent_admin">
              <ParentDashboard />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<WelcomeRedirect />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  if (firebaseInitError) {
    return <FirebaseConfigScreen />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
