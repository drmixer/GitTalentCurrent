import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft, RefreshCw } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, developerProfile, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'info' | 'redirect'>('loading'); 
  const [message, setMessage] = useState('Connecting GitHub...');

  // Function to redirect to GitHub App installation
  const redirectToGitHubAppInstall = useCallback(() => {
    const GITHUB_APP_SLUG = 'GitTalentApp'; // Your GitHub App slug
    const searchParams = new URLSearchParams(location.search);
    const stateParam = searchParams.get('state');
    
    let stateObj = {};
    if (stateParam) {
      try {
        stateObj = JSON.parse(decodeURIComponent(stateParam));
        console.log('GitHubAppSetup: Parsed state:', stateObj);
      } catch (e) {
        console.error('GitHubAppSetup: Error parsing state:', e);
      }
    }
    
    const state = JSON.stringify({
      installation_id: 'pending',
      stateParam,
      stateObj
    });
    const returnUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}&redirect_uri=${returnUrl}`;
    
    console.log('GitHubAppSetup: Redirecting to GitHub App installation:', githubAppInstallUrl);
    setUiState('redirect');
    setMessage('Redirecting to GitHub App installation page...');
    
    // Short delay to ensure UI updates before redirect
    setTimeout(() => {
      window.location.href = githubAppInstallUrl;
    }, 1000);
  }, [location.search]);

  const handleSuccess = useCallback((successMessage: string, redirectDelay: number = 2000) => {
    console.log('GitHubAppSetup: Success - ', successMessage);
    setUiState('success');
    setMessage(successMessage);
    setTimeout(() => {
      navigate('/developer?tab=github-activity', { replace: true });
    }, redirectDelay);
  }, [navigate]);

  const handleError = useCallback((errorMessage: string) => {
    console.error('GitHubAppSetup: Error - ', errorMessage);
    setUiState('error');
    setMessage(errorMessage);
  }, []);

  const saveInstallationId = useCallback(async (id: string, currentUserId: string) => { 
    try {
      const { error: updateError } = await supabase 
        .rpc('update_github_installation_id', {
          p_user_id: currentUserId,
          p_installation_id: id
        });

      if (updateError) {
        throw new Error(`Failed to save installation ID: ${updateError.message}`);
      }
      
      // After saving, refresh profile to get the latest state including the new installation ID
      if (refreshProfile) {
      }
      return true;
    } catch (error) {
      console.error('Error saving installation ID:', error instanceof Error ? error.message : error);
      throw error;
  }, [refreshProfile]);

  useEffect(() => {
    const handleSetup = async () => {
      const searchParams = new URLSearchParams(location.search);
      const installationId = searchParams.get('installation_id');
      const setupAction = searchParams.get('setup_action');
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      const state = searchParams.get('state');
  
      // Reset retry count when params change
      if (installationId || errorParam) {
        setRetryCount(0);
      }
  
      console.log('GitHubAppSetup: URL params:', { 
        installationId, 
        setupAction, 
        code,
        errorParam, 
        errorDescription,
        state
      });
  
      // Handle errors first
      if (errorParam) {
        handleError(`GitHub Error: ${errorDescription || errorParam}`);
        return;
      }
  
      // If auth is still loading, wait.
      if (authLoading) {
        console.log('GitHubAppSetup: Auth context loading, waiting...');
  
        if (retryCount > maxRetries) {
          setUiState('error');
          setMessage('Authentication is taking too long. Please try again.');
        } else {
          setUiState('loading');
          setMessage(`Verifying authentication... (Attempt ${retryCount + 1}/${maxRetries})`);
  
          // Set a timeout to increment retry count
          const timer = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            if (refreshProfile) {
              refreshProfile();
            }
          }, 2000);
          return () => clearTimeout(timer);
        }
        return;
      }
  
      // If no user after auth loading is complete, redirect to login
      if (!user) {
        console.log('GitHubAppSetup: No user, redirecting to login.');
        navigate('/login', { replace: true });
        return;
      }
  
      // Scenario 1: App Install/Reconfigure for an existing user
      if (user && installationId) {
        setUiState('loading'); 
        setMessage(`Connecting GitHub App... (Installation ID: ${installationId})`);
        console.log(`GitHubAppSetup: User ${user.id} present with installation_id ${installationId}. Action: ${setupAction}`);
  
        try {
          await saveInstallationId(installationId, user.id);
          
          if (setupAction === 'install') {
            handleSuccess('GitHub App successfully installed and connected!');
          } else {
            handleSuccess('GitHub App connection updated successfully!');
          }
          
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('installation_id');
          cleanUrl.searchParams.delete('setup_action');
          window.history.replaceState({}, '', cleanUrl.toString());
        } catch (err) {
          handleError(err instanceof Error ? err.message : 'Failed to save GitHub installation.');
        }
        return;
      }
  
      // Scenario 2: User is logged in but no installation_id in URL
      if (user && !installationId) {
        console.log(`GitHubAppSetup: User ${user.id} present, but no installation_id in URL.`);
        console.log('Developer profile:', developerProfile ? 'Loaded' : 'Not loaded');
        
        // Check if developer profile has installation ID
        const hasInstallationId = developerProfile?.github_installation_id && 
                                 developerProfile.github_installation_id !== '';
                                 
        if (hasInstallationId) {
          console.log('GitHubAppSetup: Developer profile already has an installation ID. GitHub App is connected.');
          handleSuccess('GitHub App is already connected.', 1000);
        } else {
          // Check if we need to wait for profile to load
          if (!developerProfile && retryCount < maxRetries) { 
            console.log('GitHubAppSetup: Waiting for developer profile to load...');
            setUiState('loading');
            setMessage(`Loading your profile... (Attempt ${retryCount + 1}/${maxRetries})`); 
            
            // Increment retry count and try to refresh profile
            setTimeout(() => {
              if (refreshProfile) {
                refreshProfile();
              }
              setRetryCount(prev => prev + 1);
            }, 2000);
          } else {
            console.log('GitHubAppSetup: No installation ID found. Redirecting to GitHub App installation...');
            setUiState('info');
            setMessage('Connect your GitHub account to display your contributions and repositories.');
          }
        }
        return;
      }
      
      setUiState('loading'); 
      setMessage('Please wait...');
    };

    handleSetup();
  }, [user, developerProfile, authLoading, location.search, navigate, refreshProfile, 
      handleSuccess, handleError, saveInstallationId, redirectToGitHubAppInstall, retryCount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center text-gray-900 mb-6">
          {uiState === 'loading' && 'Connecting GitHub...'}
          {uiState === 'success' && 'GitHub Connected!'}
          {uiState === 'error' && 'Connection Error'}
          {uiState === 'redirect' && 'Redirecting...'}
          {uiState === 'info' && 'GitHub Connection Action Needed'}
        </h1>

        {uiState === 'loading' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-2">
              This allows us to sync your repository data and showcase your contributions.
            </p>
          </div>
        )}

        {uiState === 'redirect' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Please wait while we redirect you...
            </p>
          </div>
        )}

        {uiState === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500 mb-4">
              Redirecting you to your dashboard...
            </p> 
            <button
              onClick={() => navigate('/developer?tab=github-activity')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              {uiState === 'error' ? 'Return to Dashboard' : 'Go to Dashboard'}
            </button>
          </div>
        )}

        {(uiState === 'error' || uiState === 'info') && (
          <div className="text-center">
            {uiState === 'error' ? (
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" aria-hidden="true" />
            ) : (
              <CheckCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" aria-hidden="true" />
            )}
            <p className={`${uiState === 'error' ? 'text-red-600' : 'text-gray-700'} mb-6`}>{message}</p>
            
            {uiState === 'info' && (
              <div className="space-y-4 mb-4">
                <p className="text-sm text-gray-600">
                  Connecting the GitHub App allows us to display your contributions, repositories, and coding activity.
                  This is a one-time setup process.
                  {retryCount > 0 && (
                    <span className="block mt-2 text-xs text-gray-500">
                      Retry attempt {retryCount} of {maxRetries}
                    </span>
                  )}
                </p>
                <button
                  onClick={redirectToGitHubAppInstall}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold mb-4"
                >
                  <Github className="w-4 h-4 mr-2 inline" aria-hidden="true" />
                  Connect GitHub App
                </button>
                <button
                  onClick={() => navigate('/developer')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  {uiState === 'error' ? 'Return to Dashboard' : 'Go to Dashboard'}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {uiState === 'error' && (
                <button
                  onClick={() => {
                    refreshProfile?.();
                    setUiState('loading');
                    setMessage('Refreshing your profile...');
                    setRetryCount(0);
                    setTimeout(() => {
                      if (developerProfile?.github_installation_id) {
                        handleSuccess('GitHub App is connected!');
                      } else {
                        setUiState('info');
                        setMessage('Connect your GitHub account to display your contributions and repositories.');
                      }
                    }, 2000);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Try Again
                </button>
              )}
              
              <button
                onClick={() => navigate('/developer')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Return to Dashboard
              </button>
            </div>
            
            {uiState === 'error' && (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium block mx-auto"
              >
                <RefreshCw className="w-4 h-4 mr-2 inline" aria-hidden="true" />
                Refresh Page
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};