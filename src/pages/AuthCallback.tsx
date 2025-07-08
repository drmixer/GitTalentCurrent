import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

// GitHub App slug - must match exactly what's configured in GitHub
const GITHUB_APP_SLUG = 'GitTalentApp'; 
// Maximum number of retries for auth loading
const maxRetries = 5;

// Interface for state data from URL parameters
interface StateData {
  name?: string;
  role?: string;
  install_after_auth?: boolean | string;
  redirect_uri?: string;
  [key: string]: any;
}

export const AuthCallback: React.FC = () => {
  const { user, userProfile, developerProfile, loading: authLoading, authError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'redirect' | 'waiting' | 'info'>('waiting');
  const [message, setMessage] = useState('Processing authentication...');
  const [processingInstallation, setProcessingInstallation] = useState(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  // const [profileCreationAttempted, setProfileCreationAttempted] = useState(false); // No longer needed
  const maxRetries = 5;
  const [authCompleted, setAuthCompleted] = useState(false);
  const [authAttempted, setAuthAttempted] = useState(false);

  // Function to redirect to GitHub App installation
  const redirectToGitHubAppInstall = useCallback(() => {
    if (!user?.id) {
      console.warn('redirectToGitHubAppInstall: No user ID available.');
      return;
    }

    const stateObj = {
      user_id: user.id,
      redirect_uri: `${window.location.origin}/github-setup`,
      from_auth: true,
      timestamp: Date.now(), // Prevent caching issues
    };

    const stateParam = encodeURIComponent(JSON.stringify(stateObj));
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}`;

    setUiState('redirect');
    setMessage('Redirecting to GitHub App installation...');

    // Delay to allow UI update before redirecting
    setTimeout(() => {
      window.location.href = githubAppInstallUrl;
    }, 500);
  }, [user]);

  useEffect(() => {
    let timeoutId: number | undefined;

    const handleAuthCallback = async () => {
      try {
        setUiState('loading');

        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const setupAction = params.get('setup_action');
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');
        const state = params.get('state');
        const installationId = params.get('installation_id');
        
        // Handle errors from OAuth
        if (errorParam) {
          setUiState('error');
          setMessage(`Authentication error: ${errorParam}`);
          return;
        }

        // Parse and normalize state parameter if present
        let stateData: StateData = {};
        if (state) {
          try {
            stateData = JSON.parse(decodeURIComponent(state));

            // Normalize install_after_auth to boolean
            if (typeof stateData.install_after_auth === 'string') {
              stateData.install_after_auth = stateData.install_after_auth.toLowerCase() === 'true';
            }

            // Store relevant data in localStorage if available
            if (stateData.name) localStorage.setItem('gittalent_signup_name', stateData.name);
            if (stateData.role) localStorage.setItem('gittalent_signup_role', stateData.role);
          } catch (parseError) {
            console.error('AuthCallback: Error parsing state parameter:', parseError);
          }
        }

        // Process GitHub App installation flow
        if (installationId) {
          if (user?.id && !processingInstallation) {
            setProcessingInstallation(true);
            setUiState('loading');
            setMessage(`GitHub App installation detected (ID: ${installationId}), updating profile...`);

            try {
              // Update the installation ID directly in the database
              const { error: updateError } = await supabase.from('developers').update({
                  github_installation_id: installationId
                }).eq('user_id', user.id);

              if (updateError) {
                console.error('Error saving installation ID:', updateError);
                setUiState('error');
                setMessage(`Failed to save GitHub installation: ${updateError.message || 'Database error'}`);
                setProcessingInstallation(false);
                return;
              }

              if (!refreshProfile) {
                console.error('refreshProfile function is not available');
                setUiState('error');
                setMessage('Failed to refresh profile. Please try again or contact support.');
                setProcessingInstallation(false);
                return;
              } 
              await refreshProfile();

              // Clean URL parameters (including code and state)
              const cleanUrl = new URL(window.location.href);
              cleanUrl.searchParams.delete('installation_id');
              cleanUrl.searchParams.delete('setup_action');
              cleanUrl.searchParams.delete('code');
              cleanUrl.searchParams.delete('state');
              window.history.replaceState({}, '', cleanUrl.toString());

              setUiState('success');
              setMessage('GitHub App successfully connected! Redirecting to dashboard...');

              setProcessingInstallation(false);

              timeoutId = window.setTimeout(() => {
                navigate('/developer?tab=github-activity', { replace: true });
              }, 2000);

              return;
            } catch (error) {
              console.error('Error processing GitHub installation:', error);
              setProcessingInstallation(false);
              setUiState('error');
              setMessage(`Error connecting GitHub App: ${error instanceof Error ? error.message : 'Unknown error'}`);
              return;
            }
          } else if (!user) {
            setUiState('loading');
            setMessage('Waiting for authentication to complete before processing GitHub installation...');
            return; 
          } else if (processingInstallation) {
            setUiState('loading');
            setMessage('Processing GitHub App installation...');
            return;
          }
        }

        // Redirect to GitHub App installation if flagged AND user doesn't already have an installation ID
        const alreadyHasInstallationId = !!developerProfile?.github_installation_id;
        if (user && stateData.install_after_auth && !installationId && !alreadyHasInstallationId) {
          setUiState('redirect');
          setMessage('Authentication successful! Finalizing GitHub App connection...'); // Updated message
          timeoutId = window.setTimeout(() => {
            redirectToGitHubAppInstall();
          }, 1500);
          return;
        }

        // If auth is still loading, wait.
        if (authLoading) {
          if (retryCount >= maxRetries) {
            setUiState('error');
            setMessage('Authentication is taking too long. Please try again.');
            return;
          }

          setUiState('loading');
          setMessage(`Verifying authentication... (Attempt ${retryCount + 1}/${maxRetries})`);
          timeoutId = window.setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000);
          return;
        }

        // If no user after auth loading is complete, redirect to login
        if (!user) {
          if (authCompleted) {
            navigate('/login', { replace: true });
          } else {
            setAuthCompleted(true);
            setUiState('loading');
            setMessage('Waiting for authentication to complete...');
            setTimeout(() => {
              if (refreshProfile) {
                refreshProfile();
              }
            }, 1500);
          }
          return;
        }

        // Normal post-auth processing & navigation
        if (user && !authLoading) {
          if (userProfile) {
            setUiState('success');
            setMessage('Authentication successful! Redirecting to dashboard...');
            
            if (userProfile.role === 'developer' && !developerProfile?.github_installation_id && !installationId) {
              setUiState('redirect');
              setMessage('Redirecting to GitHub App installation...');
              timeoutId = window.setTimeout(() => {
                redirectToGitHubAppInstall();
              }, 1500);
              return;
            }
            
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
          } else {
            setUiState('success');
            setMessage('Authentication successful! Redirecting to dashboard...');
            timeoutId = window.setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1500);
            return;
          }
        }

        // If auth is still loading, wait and retry
        if (authLoading) {
          setUiState('loading'); 
          setMessage('Verifying authentication...');
          if (retryCount >= maxRetries) {
            setMessage('Authentication is taking longer than expected. You may need to refresh the page.');
          } else {
            timeoutId = window.setTimeout(() => {
              setRetryCount(prev => prev + 1);
              if (refreshProfile) refreshProfile();
            }, 2000);
          }
          return;
        }

        // No user and auth is not loading => auth failure 
        if (!user && !authLoading) {
          setUiState('error');
          setMessage('Authentication failed. Please try again or refresh the page.');
          return;
        }
      } catch (error) {
        console.error('Error in AuthCallback useEffect:', error);
        setUiState('error'); 
        setMessage(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } 
    };

    handleAuthCallback();

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    user,
    userProfile,
    developerProfile,
    authLoading,
    navigate,
    location.search,
    processingInstallation,
    refreshProfile,
    // profileCreationAttempted, // Removed
    redirectToGitHubAppInstall,
    authAttempted,
    retryCount,
    authCompleted,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8" aria-live="polite" aria-atomic="true">
        <div className="flex justify-center mb-6"> 
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center text-gray-900 mb-6">
          {uiState === 'loading' && 'Processing Authentication'}
          {uiState === 'success' && 'Authentication Successful!'} 
          {uiState === 'redirect' && 'Redirecting...'}
          {uiState === 'error' && 'Authentication Error'} 
        </h1>

        {uiState === 'loading' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600">{message}</p>
            <div className="mt-4"> 
              <p className="text-sm text-gray-500 mb-4">
                {authLoading ? 'Verifying your authentication...' : `Loading your profile... (Attempt ${retryCount + 1}/${maxRetries})`} 
                {retryCount > 0 && <span className="block mt-2 text-xs text-gray-500">This is taking longer than expected...</span>}
              </p>
              {retryCount >= maxRetries / 2 && (
                <button
                  onClick={() => navigate('/dashboard', { replace: true })}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                > 
                  <RefreshCw className="w-4 h-4 mr-2 inline" />
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        )}

        {uiState === 'redirect' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{message}</p> 
            <p className="text-sm text-gray-500">Please wait while we redirect you to GitHub...</p>
            <p className="text-xs text-gray-500 mt-2">
              You'll be redirected to GitHub to install the GitTalent App to access your GitHub data
            </p>
          </div>
        )}

        {uiState === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{message}</p> 
            <p className="text-sm text-gray-500 mb-6">You'll be redirected to your dashboard in a moment...</p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {uiState === 'error' && (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-6">{message}</p> 
            {authError && <p className="text-sm text-red-500 mb-4">{authError}</p>}
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold w-full flex items-center justify-center"
              >
                Return to Login
              </button>
              <button
                onClick={() => { window.location.reload(); }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium w-full flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2 inline" />
                Refresh Page
              </button>
              <button
                onClick={redirectToGitHubAppInstall}
                className="px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors font-medium w-full flex items-center justify-center"
              >
                <Github className="w-4 h-4 mr-2" />
                Connect GitHub App
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};