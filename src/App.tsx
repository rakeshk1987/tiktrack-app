import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './ErrorBoundary';

function PrivateRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'child_user' | 'parent_admin' }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading Data...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (requiredRole && user.role !== requiredRole) {
     // Safety catch from infinite loop
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

// Dashboard Imports
import ChildDashboard from './pages/child/Dashboard';
import ParentDashboard from './pages/parent/Dashboard';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/child" element={
        <PrivateRoute requiredRole="child_user">
          <ChildDashboard />
        </PrivateRoute>
      } />
      <Route path="/parent" element={
        <PrivateRoute requiredRole="parent_admin">
          <ParentDashboard />
        </PrivateRoute>
      } />
      <Route path="/" element={<WelcomeRedirect />} />
    </Routes>
  );
}

function App() {
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
