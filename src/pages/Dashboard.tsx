import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DeveloperOnboarding } from '../components/Onboarding/DeveloperOnboarding';

export const Dashboard = () => {
  const { userProfile, needsOnboarding, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  // Show onboarding for developers who need to complete their profile
  if (userProfile.role === 'developer' && needsOnboarding) {
    return <DeveloperOnboarding />;
  }

  // Redirect to role-specific dashboard
  switch (userProfile.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'recruiter':
      return <Navigate to="/recruiter" replace />;
    case 'developer':
      return <Navigate to="/developer" replace />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">Welcome to GitTalent</p>
          </div>
        </div>
      );
  }
};