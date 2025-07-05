import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

// GitHub App slug - must match exactly what's configured in GitHub
const GITHUB_APP_SLUG = 'GitTalentApp';

export const AuthCallback: React.FC = () => {
  const { user, userProfile, developerProfile, loading: authLoading, authError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirect' | 'waiting' | 'info'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const [waitTime, setWaitTime] = useState(0);
  const [maxWaitTime] = useState(10000); // Maximum wait time in milliseconds 
  const [processingInstallation, setProcessingInstallation] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Function to redirect to GitHub App installation 
  const redirectToGitHubAppInstall = useCallback(() => {
    const returnUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=github_app_install&redirect_uri=${returnUrl}`;
    
    console.log('AuthCallback: Redirecting to GitHub App installation:', githubAppInstallUrl);
    setStatus('redirect');
    setMessage('Redirecting to GitHub App installation page...');
    
    // Short delay to ensure UI updates before redirect
    window.location.href = githubAppInstallUrl;
  }, []);

  useEffect(() => {
    const handleAuthCallback = async () => { 
    // Clear any previous timeouts
    let timeoutId: number;
    
    try {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const installationId = params.get('installation_id');
      const setupAction = params.get('setup_action');
      const state = params.get('state');
      const code = params.get('code');
      const error = params.get('error');
    
      console.log('AuthCallback: URL params:', { installationId, setupAction, state, code, error });
    
      // Handle errors first
      if (error) {
        setStatus('error');
        setMessage(`Authentication error: ${params.get('error_description') || error}`);
        return;
      }

      // GitHub App installation flow
      if (installationId) {
        // Only process installation if we have a user and haven't processed it yet
        if (user?.id && !processingInstallation) {
          setProcessingInstallation(true);
          setStatus('loading'); 
          setMessage('GitHub App installation detected, saving installation ID...');
          
          try {
            // Save the installation ID directly here
            const { data, error: updateError } = await supabase.functions.invoke('update-github-installation', {
              body: { 
                userId: user.id,
                installationId: installationId
              }
            });
              
            if (updateError) {
              console.error('Error saving installation ID:', updateError);
              setStatus('error');
              setMessage(`Failed to save GitHub installation: ${updateError.message}`);
              return;
            }
            
            console.log('Successfully saved installation ID:', installationId, data);
            
            // Refresh the profile to get the updated installation ID 
            if (!refreshProfile) {
              console.warn('refreshProfile function is not available');
            }
            await refreshProfile?.();
            
            // Clear the installation_id from URL to prevent reprocessing
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('installation_id');
            cleanUrl.searchParams.delete('setup_action');
            window.history.replaceState({}, '', cleanUrl.toString());
            
            setStatus('success'); 
            setMessage('GitHub App successfully connected! Redirecting to dashboard...');
            
            // Redirect to GitHub activity tab after a short delay
            setTimeout(() => {
              navigate('/developer?tab=github-activity', { replace: true });
            }, 2000);
            return;
          } catch (error) {
            console.error('Error processing GitHub installation:', error); 
            setStatus('error');
            setMessage(`Error connecting GitHub App: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
          }
        } else if (!user) {
          // If we don't have a user yet but have installation_id, wait for auth to complete
          setStatus('loading');
          setMessage('Waiting for authentication to complete before processing GitHub installation...'); 
          return;
        }
      }

      // If we have a user but no specific flow detected, proceed to dashboard or onboarding
      if (user) {
        console.log('AuthCallback: User authenticated:', user.id);
        console.log('AuthCallback: User profile:', userProfile ? 'Loaded' : 'Not loaded'); 
        
        // If we have a user but no profile, try to refresh the profile
        if (!userProfile && refreshProfile) {
          console.log('AuthCallback: Refreshing profile...');
          await refreshProfile();
        }
      
        // If we also have a profile, we can navigate to the dashboard
        if (userProfile) {
          console.log('AuthCallback: User profile loaded:', userProfile.id);
          setStatus('success');
          setMessage('Authentication successful! Redirecting to dashboard...');

          // For developers, check if GitHub App is connected
          if (userProfile.role === 'developer') {
            // Check if GitHub App is connected
            if (developerProfile && !developerProfile.github_installation_id) { 
              console.log('AuthCallback: Developer needs to connect GitHub App');
              timeoutId = window.setTimeout(() => {
                redirectToGitHubAppInstall();
              }, 1500);
              return;
            }
          }

          // Otherwise, redirect to appropriate dashboard based on role
          timeoutId = window.setTimeout(() => { 
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
          if (refreshProfile) {
            await refreshProfile();
          }
          timeoutId = window.setTimeout(() => {
            setStatus('loading');
            setMessage(`Loading your profile... (${Math.round(waitTime/1000)}s)`);
          }, 1000);
          return;
        }

        // If we've waited too long, just go to dashboard
        setStatus('success'); 
        setMessage('Authentication successful! Redirecting to dashboard...');
        timeoutId = window.setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1000);
        return;
      }
    } catch (error) {
      console.error('Error in AuthCallback useEffect:', error); 
      setStatus('error');
      setMessage('An unexpected error occurred during authentication.');
    }
    
    // Cleanup function to clear any timeouts
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    };
    
    handleAuthCallback(); 
  }, [user, userProfile, authLoading, navigate, location.search, waitTime, processingInstallation, refreshProfile]);

  // Add a separate effect to handle the case where we have a user but no installation_id in URL
  useEffect(() => {
    let timeoutId: number;
    
    try {
    if (user && userProfile?.role === 'developer' && developerProfile && !processingInstallation) { 
      // If developer has no GitHub installation ID, suggest connecting
      if (!developerProfile.github_installation_id && developerProfile.github_handle) {
        console.log('Developer has GitHub handle but no installation ID, suggesting connection');
        setStatus('info');
        setMessage('Your GitHub account is connected, but you need to install the GitHub App to see your contributions.');
      }
    }
    
      // If auth is still loading, wait 
      if (authLoading) {
        setStatus('loading');
        setMessage(`Verifying authentication... (Attempt ${retryCount + 1})`);
        
        // Set a timeout to retry
        if (retryCount < 5) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 1000);
        }
        
        // Set a timeout to retry
        if (retryCount < 5) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 1000);
        }
        return;
      }
      
      // If we don't have a user and auth is not loading, redirect to login
      if (!user && !authLoading) {
        setStatus('error');
        setMessage('Authentication failed. Please try again.');
        return;
      }
    } catch (error) {
      console.error('Error in AuthCallback useEffect:', error); 
      setStatus('error');
      setMessage('An unexpected error occurred during authentication.');
    }
    
    // Cleanup function to clear any timeouts
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [user, userProfile, developerProfile, processingInstallation]);

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
                <p className="text-sm text-gray-500">This is taking longer than expected... ({Math.round(waitTime/1000)}s)</p>
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
            <button onClick={() => window.location.reload()} className="mt-4 text-sm text-blue-600 hover:underline">
              Click here if you're not redirected automatically
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirecting you to your dashboard in a moment...
            </p>
            <p className="text-xs text-gray-400 mt-2">
              If you're not redirected automatically, click the button below.
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
              <button
                onClick={redirectToGitHubAppInstall}
                className="mt-4 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors font-medium"
              >
                Connect GitHub App
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};