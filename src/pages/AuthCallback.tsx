import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const { user, userProfile, loading: authLoading, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirect' | 'waiting'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const [waitTime, setWaitTime] = useState(0);
  const [maxWaitTime] = useState(10000); // Maximum wait time in milliseconds

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const githubAppSetup = params.get('github_app_setup');
    const githubAppSetup = params.get('github_app_setup');
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');
    const error = params.get('error');
    
    console.log('AuthCallback: URL params:', { code, githubAppSetup, installationId, setupAction, error });
    
    // Handle errors first
    if (error) {
      setStatus('error');
      setMessage(`Authentication error: ${params.get('error_description') || error}`);
      return;
    }

    // If this is a GitHub App setup flow, redirect to GitHub App setup page
    if (githubAppSetup === 'true' && user) {
      console.log('AuthCallback: GitHub App setup flow detected, redirecting...');
      setStatus('redirect');
      setMessage('GitHub authentication successful, redirecting to GitHub App setup...');
      navigate('/github-setup', { replace: true });
      return;
    }

    // If this is a GitHub App setup flow, redirect to GitHub App setup page
    if (githubAppSetup === 'true' && user) {
      console.log('AuthCallback: GitHub App setup flow detected, redirecting...');
      setStatus('redirect');
      setMessage('GitHub authentication successful, redirecting to GitHub App setup...');
      navigate('/github-setup', { replace: true });
      return;
    }

    // GitHub App installation flow
    if (installationId) {
      setStatus('redirect');
      setMessage('GitHub App installation detected, redirecting...');
      // Redirect to GitHub setup page with the installation parameters
      navigate(`/github-setup?installation_id=${installationId}&setup_action=${setupAction || 'install'}`, { replace: true });
      return;
    }

    // If we have a user but no specific flow detected, proceed to dashboard or onboarding
    if (user) {
      console.log('AuthCallback: User authenticated:', user.id);
      
      // If we also have a profile, we can navigate to the dashboard
      if (userProfile) {
      setMessage('Authentication successful! Redirecting to dashboard...');
        setStatus('success');
        setMessage('Authentication successful!');

        // Redirect to appropriate page based on role and approval status
        setTimeout(() => {
          if (userProfile.role === 'developer') {
            navigate('/developer', { replace: true });
          } else if (userProfile.role === 'recruiter') {
            if (userProfile.is_approved) {
              navigate('/recruiter', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          } else if (userProfile.role === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 1500);
        return;
      }

      // If we have a user but no profile, wait a bit longer
      if (waitTime < maxWaitTime) {
        setWaitTime(prev => prev + 1000);
        setTimeout(() => {
          setStatus('loading');
          setMessage('Loading your profile...');
        }, 1000);
        return;
      }

      // If we've waited too long, just go to dashboard
      setStatus('success');
      setMessage('Authentication successful! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1000);
      return;
    }
    
    // If auth is still loading, wait
    if (authLoading) {
      setStatus('loading');
      setMessage('Verifying authentication...');
      return;
    }
    
    // If we don't have a user and auth is not loading, redirect to login
    if (!user && !authLoading) {
      setStatus('error');
      setMessage('Authentication failed. Please try again.');
      return;
    }
  }, [user, userProfile, authLoading, navigate, location.search, waitTime]);

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
            {waitTime > 3000 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500">This is taking longer than expected...</p>
                <button 
                  onClick={() => navigate('/dashboard', { replace: true })}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Go to Dashboard
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
              <span className="block mt-2 text-xs text-gray-400">
                If you're not redirected automatically, click the button below.
              </span>
            </p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-6">{message}</p>
            {authError && (
              <p className="text-sm text-red-500 mb-4">{authError}</p>
            )}
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                Return to Login
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4 mr-2 inline" />
                Refresh Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};