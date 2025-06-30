import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DeveloperOnboarding } from '../components/Onboarding/DeveloperOnboarding';
import { Loader, AlertCircle, RefreshCw, Code, Building, Shield, LogOut } from 'lucide-react';

export const Dashboard = () => {
  const { user, userProfile, developerProfile, needsOnboarding, loading, refreshProfile, signOut } = useAuth();

  console.log('🔍 Dashboard render state:', {
    user: !!user,
    userProfile: !!userProfile,
    userRole: userProfile?.role || 'none',
    developerProfile: !!developerProfile,
    needsOnboarding,
    loading
  });

  useEffect(() => {
    if (user && !userProfile && !loading) {
      console.log('🔄 Dashboard: User exists but no profile, refreshing profile');
      refreshProfile();
    }
  }, [user, userProfile, loading, refreshProfile]);

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md mx-auto px-4">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your profile...</p>
          <p className="text-gray-500 text-sm mt-2">Verifying your account status...</p>
          
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
            <p className="text-sm text-blue-800 font-medium mb-2">What's happening?</p>
            <p className="text-sm text-blue-700">
              We're verifying your authentication status and loading your profile data to ensure you're directed to the right dashboard.
            </p>
          </div>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-4">Profile Not Found</h1>
            <p className="text-gray-600 mb-6">
              We couldn't load your profile data. This might be a temporary issue with the database connection.
            </p> 
            <div className="space-y-3">
              <button
                onClick={refreshProfile}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={signOut}
                  className="w-full flex items-center justify-center px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Back to Login
                </button>
              </div>
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
        return <Navigate to="/developer" replace={true} />;
      }
      
      // If no developer profile but not flagged for onboarding, show error
      console.log('❌ Developer role but no profile and no onboarding flag');
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md mx-auto text-center px-4">
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
                  onClick={() => window.location.replace('/onboarding')}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                >
                  Complete Profile Setup
                </button>
              </div>
            </div>
          </div>
        </div>
      );

    case 'recruiter':
      // Check if recruiter is approved
      if (!userProfile.is_approved) {
        console.log('⚠️ Recruiter not approved yet, showing pending approval screen');
        return <Navigate to="/recruiter" replace={true} />;
      }
      
      console.log('✅ Recruiter found, redirecting to recruiter dashboard');
      return <Navigate to="/recruiter" replace={true} />;

    case 'admin':
      console.log('✅ Admin found, redirecting to admin dashboard');
      return <Navigate to="/admin" replace={true} />;

    default:
      console.log('❌ Unknown role:', userProfile.role);
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md mx-auto text-center px-4">
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-gray-600" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 mb-4">Unknown Role</h1>
              <p className="text-gray-600 mb-6">
                Your account role ({userProfile.role}) is not recognized. Please contact support for assistance.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => window.location.replace('/login')}
                  className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold flex-1"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      );
  }
};