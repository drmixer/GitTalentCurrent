import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth'; 
import { Navigate, useNavigate } from 'react-router-dom';
import { DeveloperOnboarding } from '../components/Onboarding/DeveloperOnboarding';
import { Loader, AlertCircle, RefreshCw, Code, Building, Shield, LogOut, XCircle } from 'lucide-react';

export const Dashboard = () => {
  const { user, userProfile, developerProfile, needsOnboarding, loading, authError, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [waitTime, setWaitTime] = useState(0);

  console.log('🔍 Dashboard state:', {
    user: !!user,
    userProfile: !!userProfile,
    userRole: userProfile?.role || 'none',
    developerProfile: !!developerProfile,
    needsOnboarding,
    loading
  });

  useEffect(() => {
    console.log('Dashboard useEffect - user:', !!user, 'userProfile:', !!userProfile, 'loading:', loading);
    
    // If we have a user but no profile and we're not already loading, try to refresh the profile with a delay
    if (user && !userProfile && !loading && !needsOnboarding) {
      console.log('🔄 Dashboard: User exists but no profile, refreshing profile...');

      // Increment wait time
      const timer = setTimeout(() => {
        setWaitTime(prev => prev + 1000);
        refreshProfile();
      }, 1000);
      
      // Clean up the timer when the component unmounts
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, loading, refreshProfile, needsOnboarding, waitTime]);

  // If there's an auth error, show it
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-4">Authentication Error</h1>
            <p className="text-gray-600 mb-6">
              {authError}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  window.location.href = '/login';
                }}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Return to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md mx-auto px-4">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your profile... ({Math.round(waitTime/1000)}s)</p>
          <p className="text-gray-500 text-sm mt-2">This may take a few moments...</p>
          
          {waitTime > 5000 && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
              <p className="text-sm text-blue-800 font-medium mb-2">Taking longer than expected?</p>
              <div className="flex space-x-4 mt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh page
                </button>
                <button
                  onClick={() => navigate('/login', { replace: true })}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  Back to login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If no user is authenticated, redirect to login
  if (!user) {
    console.log('❌ No user found, redirecting to login');
    return <Navigate to="/login" replace={true} />;
  }

  // If user exists but no profile, show error with retry option
  if (!userProfile) {
    console.log('❌ User exists but no profile found');
    
    // If we're still loading or it's been less than 5 seconds since mount, show loading
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading your profile...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a few moments...</p>
          </div>
        </div>
      );
    }
    
    
    // If we're still loading or it's been less than 5 seconds since mount, show loading
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading your profile...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a few moments...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md mx-auto px-4">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your profile...</p>
          <p className="text-gray-500 text-sm mt-2">This may take a few moments...</p>
          
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
            <p className="text-sm text-blue-800 font-medium mb-2">Still having trouble?</p>
            <div className="flex space-x-4">
              <button
                onClick={refreshProfile}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh profile
              </button>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
              >
                <LogOut className="w-3 h-3 mr-1" />
                Back to login
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
                  onClick={() => navigate('/onboarding', { replace: true })}
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
                  onClick={() => {
                    signOut().then(() => {
                      navigate('/login', { replace: true });
                    }).catch(() => {
                      navigate('/login', { replace: true });
                    });
                  }}
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