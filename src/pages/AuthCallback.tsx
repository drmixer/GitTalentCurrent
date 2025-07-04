import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader, CheckCircle, AlertCircle, Github } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const { user, userProfile, developerProfile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirect' | 'waiting'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const [waitCount, setWaitCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');
    const error = params.get('error');
    const requiresGitHubInstall = localStorage.getItem('requiresGitHubInstall') === 'true';
    
    console.log('AuthCallback: URL params:', { code, installationId, setupAction, error, requiresGitHubInstall });
    
    // Handle errors first
    if (error) {
      setStatus('error');
      setMessage(`Authentication error: ${params.get('error_description') || error}`);
      return;
    }

    // If auth is still loading, wait.
    if (authLoading) {
      console.log('AuthCallback: Auth context loading, waiting...');
      setStatus('loading');
      setMessage('Verifying authentication...');
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

    // Scenario 1: GitHub App installation flow
    if (installationId) {
      setStatus('redirect');
      setMessage('GitHub App installation detected, redirecting...');
      // Redirect to GitHub setup page with the installation parameters
      navigate(`/github-setup?installation_id=${installationId}&setup_action=${setupAction || 'install'}`, { replace: true });
      return;
    }

    // Scenario 2: Regular GitHub OAuth login (user is not null, no installationId)
    // Check if developerProfile is loaded and if GitHub App installation is required
    if (user.app_metadata?.provider === 'github' && requiresGitHubInstall) {
      console.log('AuthCallback: GitHub user and requiresGitHubInstall flag is true. Redirecting to GitHub setup.');
      // Clear the flags as we are handling the redirect
      localStorage.removeItem('isNewSignup');
      localStorage.removeItem('requiresGitHubInstall');

      setStatus('redirect');
      setMessage('Redirecting to GitHub setup...');
      navigate('/github-setup', { replace: true });
      return;
    }

    // Scenario 3: User is authenticated, no GitHub App installation needed, profile should be loaded
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
    // This means the profile is still being fetched or created by AuthContext.
    // Keep showing loading and let AuthContext update the state.
    console.log('AuthCallback: User authenticated but profile not yet loaded. Waiting for profile...');
    setStatus('loading');
    setMessage('Loading your profile...');

  }, [user, userProfile, developerProfile, authLoading, navigate, location.search, refreshProfile]);

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
            {status === 'waiting' && (
              <div className="mt-4">
                <p className="text-sm text-gray-500">This is taking longer than expected...</p>
                <button 
                  onClick={() => navigate('/login', { replace: true })}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Return to login
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
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};