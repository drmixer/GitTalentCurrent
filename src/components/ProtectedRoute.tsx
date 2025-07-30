// src/components/ProtectedRoute.tsx

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userProfile, loading, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  if (!user) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to. This allows us to send them back after login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (needsOnboarding && userProfile?.role === 'developer') {
    return <Navigate to="/onboarding" replace />;
  }

  if (userProfile && !allowedRoles.includes(userProfile.role)) {
    // If user's role is not allowed, redirect them to a generic dashboard or an error page
    return <Navigate to="/dashboard" replace />;
  }
  
  // If we have a user and their role is allowed, render the component
  return children;
};
