import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import type { AuthAction, AuthResource } from '../lib/auth.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  action?: AuthAction;
  resource?: AuthResource;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, action, resource }) => {
  const { isAuthenticated, isLoading, activeSalon, memberships, role } = useAuth();
  const { can } = usePermissions(role);

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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!activeSalon) {
    if (memberships.length > 0) {
      return <Navigate to="/select-salon" replace />;
    }
    return <Navigate to="/create-salon" replace />;
  }

  if (action && resource && !can(action, resource)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
