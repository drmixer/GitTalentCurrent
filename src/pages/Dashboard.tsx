import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DeveloperOnboarding } from '../components/Onboarding/DeveloperOnboarding';
import { Loader, AlertCircle, RefreshCw, Code, Building, Shield } from 'lucide-react';

export const Dashboard = () => {
  const { user, userProfile, developerProfile, needsOnboarding, loading, refreshProfile } = useAuth();

  console.log('🔍 Dashboard state:', {
    user: !!user,
    userProfile: !!userProfile,
    userRole: userProfile?.role,
    developerProfile: !!developerProfile,
    needsOnboarding,
    loading
  });

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your profile...</p>
          <p className="text-gray-500 text-sm mt-2">This may take a moment...</p>
        </div>
      </div>
    );
  }

  // If no user is authenticated, redirect to login
  if (!user) {
    console.log('❌ No user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // If user exists but no profile, show error with retry option
  if (!userProfile) {
    console.log('❌ User exists but no profile found');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-4">Profile Not Found</h1>
            <p className="text-gray-600 mb-6">
              We couldn't load your profile. This might be a temporary issue.
            </p>
            <div className="space-y-3">
              <button
                onClick={refreshProfile}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle role-specific routing
  switch (userProfile.role) {
    case 'developer':
      // If developer needs onboarding, show onboarding
      if (needsOnboarding) {
        console.log('🔄 Developer needs onboarding');
        return <DeveloperOnboarding />;
      }
      
      // If developer profile exists, redirect to developer dashboard
      if (developerProfile) {
        console.log('✅ Developer profile found, redirecting to developer dashboard');
        return <Navigate to="/developer" replace />;
      }
      
      // If no developer profile but not flagged for onboarding, show error
      console.log('❌ Developer role but no profile and no onboarding flag');
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Code className="w-8 h-8 text-yellow-600" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 mb-4">Profile Setup Required</h1>
              <p className="text-gray-600 mb-6">
                Your developer profile needs to be completed before you can access the dashboard.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = '/onboarding'}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                >
                  Complete Profile Setup
                </button>
                <button
                  onClick={refreshProfile}
                  className="w-full flex items-center justify-center px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      );

    case 'recruiter':
      console.log('✅ Recruiter found, redirecting to recruiter dashboard');
      return <Navigate to="/recruiter" replace />;

    case 'admin':
      console.log('✅ Admin found, redirecting to admin dashboard');
      return <Navigate to="/admin" replace />;

    default:
      console.log('❌ Unknown role:', userProfile.role);
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-gray-600" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 mb-4">Unknown Role</h1>
              <p className="text-gray-600 mb-6">
                Your account role ({userProfile.role}) is not recognized. Please contact support for assistance.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = 'mailto:support@gittalent.dev'}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                >
                  Contact Support
                </button>
                <button
                  onClick={() => window.location.href = '/login'}
                  className="w-full px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      );
  }
};