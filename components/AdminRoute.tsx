// components/AdminRoute.tsx
import type React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Profile is still loading after session established
  if (isAuthenticated && profile === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile?.is_admin) return <Navigate to="/" replace />;

  return <>{children}</>;
};
