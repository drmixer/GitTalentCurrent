import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

// GitHub App slug - must match exactly what's configured in GitHub
const GITHUB_APP_SLUG = 'GitTalentApp';

// Interface for state data from URL parameters
interface StateData {
  name?: string;
  role?: string;
  install_after_auth?: boolean;
  redirect_uri?: string;
  [key: string]: any;
}

export const AuthCallback: React.FC = () => {
  const { user, userProfile, developerProfile, loading: authLoading, authError, refreshProfile } = useAuth();
  const navigate = useNavigate(); 
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirect' | 'waiting' | 'info'>('waiting');
  const [message, setMessage] = useState('Processing authentication...');
  const [processingInstallation, setProcessingInstallation] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // Function to redirect to GitHub App installation page
  const redirectToGitHubAppInstall = useCallback(() => {
    // Create a state object with all necessary information
    const stateObj = {
      redirect_uri: `${window.location.origin}/github-setup`,
      user_id: user?.id,
      from_auth: true
    };

    const stateParam = encodeURIComponent(JSON.stringify(stateObj));
    const returnUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}&redirect_uri=${returnUrl}`;
    
    console.log('AuthCallback: Redirecting to GitHub App installation:', githubAppInstallUrl);
    setStatus('redirect');
    setMessage('Redirecting to GitHub App installation page...');

    // Short delay to ensure UI updates before redirect
    window.location.href = githubAppInstallUrl;
  }, [user]);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Variable to store timeout ID
      let timeoutId: number | undefined; 
      
      try {
        setStatus('loading');
        
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const installationId = params.get('installation_id');
        const stateParam = params.get('state');
        const errorParam = params.get('error'); 
        
        console.log('AuthCallback: URL params:', { code, installationId, stateParam, errorParam });
        
        // Handle errors first
        if (errorParam) {
          setStatus('error');
          setMessage(`Authentication error: ${params.get('error_description') || errorParam}`);
          return;
        }
        
        // Parse state parameter if present
        let stateData: StateData = {};
        if (stateParam) {
          try {
            stateData = JSON.parse(decodeURIComponent(stateParam));
            console.log('AuthCallback: Parsed state data:', stateData);
            
            // Store relevant data in localStorage if available 
            if (stateData.name) localStorage.setItem('gittalent_signup_name', stateData.name);
            if (stateData.role) localStorage.setItem('gittalent_signup_role', stateData.role);
            console.log('AuthCallback: Stored data in localStorage, install_after_auth:', stateData.install_after_auth);
          } catch (parseError) {
            console.error('AuthCallback: Error parsing state parameter:', parseError);
          }
        }
        
        // GitHub App installation flow
        if (installationId) {
          // Only process installation if we have a user and haven't processed it yet
          if (user?.id && !processingInstallation) {
            setProcessingInstallation(true);
            setStatus('loading'); 
            setMessage(`GitHub App installation detected (ID: ${installationId}), saving...`);

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
                console.error('refreshProfile function is not available');
                setStatus('error');
                setMessage('Failed to refresh profile. Please try again.');
                return;
              }
              await refreshProfile();
              
              // Clear URL parameters
              const cleanUrl = new URL(window.location.href);
              cleanUrl.searchParams.delete('installation_id');
              cleanUrl.searchParams.delete('setup_action');
              window.history.replaceState({}, '', cleanUrl.toString());
              
              setStatus('success'); 
              setMessage('GitHub App successfully connected! Redirecting to dashboard...');

              // Redirect to GitHub activity tab
              timeoutId = window.setTimeout(() => {
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
            console.log('AuthCallback: Have installation_id but no user yet, waiting for auth to complete');
            setStatus('loading'); 
            setMessage('Waiting for authentication to complete before processing GitHub installation...'); 
            return;
          }
        }

        // Check if we need to redirect to GitHub App installation after auth
        if (user && stateData && stateData.install_after_auth === true && !installationId) {
          console.log('AuthCallback: User authenticated, install_after_auth flag detected, redirecting to GitHub App installation');
          setStatus('redirect');
          setMessage('Authentication successful! Redirecting to GitHub App installation...'); 
          
          // Redirect to GitHub App installation after a short delay
          timeoutId = window.setTimeout(() => {
            redirectToGitHubAppInstall();
          }, 1500);
          return;
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
            console.log('AuthCallback: User profile loaded:', userProfile.id, 'Role:', userProfile.role);
            setStatus('success'); 
            setMessage('Authentication successful! Redirecting to dashboard...');
            
            // For developers, check if GitHub App is connected
            if (userProfile.role === 'developer') {
              // Check if GitHub App is connected
              if (!developerProfile?.github_installation_id) {
                console.log('AuthCallback: Developer needs to connect GitHub App, redirecting to installation page');
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
          } else {
            // If we have a user but no profile, go to dashboard anyway
            console.log('AuthCallback: User authenticated but no profile loaded yet, redirecting to dashboard');
            setStatus('success'); 
            setMessage('Authentication successful! Redirecting to dashboard...');
            timeoutId = window.setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1500);
            return;
          }
        }
        
        // If we don't have a user yet, keep waiting
        if (authLoading) {
          setStatus('loading');
          setMessage('Verifying authentication...');
          
          // If we've been waiting too long, show a retry button
          if (retryCount >= maxRetries) {
            setMessage('Authentication is taking longer than expected. You may need to refresh the page.');
          }
          return;
        }
        
        // If auth is not loading and we still don't have a user, there was an error
        if (!user && !authLoading) {
          setStatus('error');
          setMessage('Authentication failed. Please try again.');
          return;
        }
        
        // Increment retry count if we're still waiting
        if (status === 'loading' || status === 'waiting') {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000);
        }
      } catch (error) {
        console.error('Error in AuthCallback useEffect:', error); 
        setStatus('error');
        setMessage(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } 
      
      // Cleanup function to clear any timeouts
      return () => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      };
    };
    
    handleAuthCallback();
  }, [user, userProfile, developerProfile, authLoading, navigate, location.search, processingInstallation, refreshProfile, redirectToGitHubAppInstall]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" aria-hidden="true" />
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
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600">{message}</p>
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                {authLoading ? 'Verifying your authentication...' : `Loading your profile... (Attempt ${retryCount + 1})`}
              </p>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {status === 'redirect' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Please wait while we redirect you...
            </p>
            <p className="text-xs text-gray-400 mt-2">
              You'll be redirected to GitHub to install the GitTalent App
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirecting you to your dashboard in a moment...
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
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" aria-hidden="true" />
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