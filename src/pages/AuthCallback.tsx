import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const { user, userProfile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirect' | 'waiting'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');
    const error = params.get('error');
    
    console.log('AuthCallback: URL params:', { code, installationId, setupAction, error });
    
    // Handle errors first
    if (error) {
      setStatus('error');
      setMessage(`Authentication error: ${params.get('error_description') || error}`);
      return;
    }

    // If auth is still loading, wait.
    if (authLoading) {
      console.log('AuthCallback: Auth context loading, waiting...');
      if (retryCount > maxRetries) {
        setStatus('error');
        setMessage('Authentication is taking too long. Please try again.');
      } else {
        setStatus('loading');
        setMessage('Verifying authentication...');
      }
      return;
    }

    // If no user after auth loading is complete, redirect to login
    if (!user) {
      console.log('AuthCallback: No user, redirecting to login.');
      navigate('/login', { replace: true });
      return;
    }

    // User is authenticated (user is not null)
    console.log('AuthCallback: User is authenticated:', user.id);

    // GitHub App installation flow
    if (installationId) {
      setStatus('redirect');
      setMessage('GitHub App installation detected, redirecting...');
      // Redirect to GitHub setup page with the installation parameters
      navigate(`/github-setup?installation_id=${installationId}&setup_action=${setupAction || 'install'}`, { replace: true });
      return;
    }

    // Regular GitHub OAuth login (user is not null, no installationId)
    // User is authenticated, profile should be loaded
    if (userProfile) {
      console.log('AuthCallback: User profile loaded. Authentication successful!');
      setStatus('success');
      setMessage('Authentication successful!');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
      return;
    }

    // If we reach here, user is authenticated but userProfile is still null.
    if (retryCount < maxRetries) {
      console.log(`AuthCallback: User authenticated but profile not yet loaded. Retry ${retryCount + 1}/${maxRetries}`);
      setStatus('loading');
      setMessage(`Loading your profile... (Attempt ${retryCount + 1}/${maxRetries})`);
      
      // Increment retry count and manually refresh profile
      setRetryCount(retryCount + 1);
      refreshProfile?.();
    } else {
      // After max retries, show error with manual refresh option
      console.log('AuthCallback: Max retries reached, showing error');
      setStatus('error');
      setMessage('We had trouble loading your profile. Please try refreshing or logging in again.');
    }

  }, [user, userProfile, authLoading, navigate, location.search, refreshProfile, retryCount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center text-gray-900 mb-6">
          {status === 'loading' && 'Processing Authentication'}
          {status === 'success' && 'Authentication Successful!'}
          {status === 'redirect' && 'Redirecting...'}
          {status === 'error' && 'Authentication Error'}
        </h1>

        {status === 'loading' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">{message}</p>
            {retryCount > 2 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500">This is taking longer than expected...</p>
                <button
                  onClick={() => {
                    refreshProfile?.();
                    setRetryCount(0);
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center mx-auto"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Loading Profile
                </button>
              </div>
            )}
          </div>
        )}

        {status === 'redirect' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Please wait while we redirect you...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirecting you to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-6">{message}</p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => {
                  refreshProfile?.();
                  setRetryCount(0);
                  setStatus('loading');
                  setMessage('Trying again...');
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Return to Login
              </button>
            </div>
          </div>
          </div>
        )}
    </div>
  );
};