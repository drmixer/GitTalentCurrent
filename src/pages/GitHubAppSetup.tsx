import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft, RefreshCw } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, userProfile, developerProfile, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'info' | 'redirect'>('info');
  const [message, setMessage] = useState('Connecting GitHub...');
  const [processingInstallation, setProcessingInstallation] = useState(false);

  // Function to redirect to GitHub App installation
  const redirectToGitHubAppInstall = useCallback(() => {
    const GITHUB_APP_SLUG = 'GitTalentApp';
    
    // Create a state object with user ID and redirect info
    const stateObj = {
      redirect_uri: `${window.location.origin}/github-setup`,
      user_id: user?.id,
      timestamp: Date.now() // Add timestamp to prevent caching issues
    };
    
    console.log('GitHubAppSetup: Creating state object for GitHub App installation:', stateObj);
    const state = encodeURIComponent(JSON.stringify(stateObj));
    
    const redirectUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${state}&redirect_uri=${redirectUrl}`;
    
    console.log('GitHubAppSetup: Redirecting to GitHub App installation:', githubAppInstallUrl);
    setUiState('redirect');
    setMessage('Redirecting to GitHub App installation page...');
    
    console.log('GitHubAppSetup: Setting timeout for redirect to GitHub App installation');
    setTimeout(() => {
      window.location.href = githubAppInstallUrl;
    }, 1000);
  }, [user]);

  const handleSuccess = useCallback((successMessage: string, redirectDelay: number = 2000) => {
    console.log('GitHubAppSetup: Success - ', successMessage);
    console.log(`GitHubAppSetup: Will redirect to dashboard in ${redirectDelay}ms`);
    setUiState('success');
    setMessage(successMessage);
    setTimeout(() => {
      navigate('/developer?tab=github-activity', { replace: true });
    }, redirectDelay);
  }, [navigate]);

  const handleError = useCallback((errorMessage: string) => {
    console.error('GitHubAppSetup: Error - ', errorMessage);
    console.log('GitHubAppSetup: Setting error state with message:', errorMessage);
    setUiState('error');
    setMessage(errorMessage);
  }, []);

  useEffect(() => {
    const handleSetup = async () => {
      const searchParams = new URLSearchParams(location.search);
      const installationId = searchParams.get('installation_id'); 
      const setupAction = searchParams.get('setup_action');
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error'); 
      const errorDescription = searchParams.get('error_description'); 
      const state = searchParams.get('state');
      
      console.log('GitHubAppSetup: URL parameters:', { 
        installationId, 
        setupAction, 
        code,
        errorParam, 
        errorDescription,
        state
      });
      console.log('GitHubAppSetup: Full URL:', window.location.href);
      console.log('GitHubAppSetup: Auth loading:', authLoading);
      console.log('GitHubAppSetup: User:', user ? `Exists (${user.id})` : 'Not loaded');
      console.log('GitHubAppSetup: Developer profile:', developerProfile ? 
        `Exists (GitHub handle: ${developerProfile.github_handle}, Installation ID: ${developerProfile.github_installation_id || 'none'})` : 
        'Not loaded');
  
      // Reset retry count when params change
      if (installationId || errorParam) {
        setRetryCount(0);
      }
  
      // Handle errors first 
      if (errorParam) {
        handleError(`GitHub Error: ${errorDescription || errorParam}`);
        return;
      }
  
      // If auth is still loading, wait.
      if (authLoading) {
        console.log(`GitHubAppSetup: Auth context loading, waiting... (Attempt ${retryCount + 1} of ${maxRetries})`);

        if (retryCount >= maxRetries) {
          setUiState('error');
          setMessage('Authentication is taking too long. Please try again.');
        } else {
          setUiState('loading');
          setMessage(`Verifying authentication... (Attempt ${retryCount + 1}/${maxRetries})`);
          
          // Set a timeout to increment retry count.
          // DO NOT call refreshProfile here; AuthContext handles its own loading cycle.
          // GitHubAppSetup should wait for authLoading to become false.
          const timer = setTimeout(() => {
            setRetryCount(prev => prev + 1); 
            // if (refreshProfile) { // Removed refreshProfile call
            //   refreshProfile();
            // }
          }, 2000);
          return () => clearTimeout(timer);
        }
        return;
      } 
  
      // If no user after auth loading is complete, redirect to login
      if (!user) {
        console.log('GitHubAppSetup: No user found after auth loading completed, redirecting to login');
        navigate('/login', { replace: true });
        return;
      }
  
      // Scenario 1: App Install/Reconfigure for an existing user
      // This block should now primarily react to developerProfile changes after refreshProfile is called once.
      if (user && installationId && developerProfile?.github_installation_id === installationId) {
        // If installationId is in URL AND it matches what's in the developerProfile, consider it done.
        console.log(`GitHubAppSetup: Installation ID ${installationId} matches profile. Setup complete.`);
        // Clear URL parameters
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('installation_id');
        cleanUrl.searchParams.delete('setup_action');
        cleanUrl.searchParams.delete('state');
        window.history.replaceState({}, '', cleanUrl.toString());

        if (setupAction === 'install') {
          handleSuccess('GitHub App successfully installed and connected!');
        } else {
          handleSuccess('GitHub App connection updated successfully!');
        }
        return;

      } else if (user && installationId && !processingInstallation) {
        setProcessingInstallation(true); // Indicate processing has started
        setUiState('loading');
        console.log('GitHubAppSetup: Found installation_id in URL, initiating processing with Edge Function');
        console.log(`GitHubAppSetup: User ${user.id} present with installation_id ${installationId}. Action: ${setupAction}`);
        setMessage(`Connecting GitHub App... (Installation ID: ${installationId})`);
  
        try {
          console.log('GitHubAppSetup: Calling update-github-installation function with:', {
            userId: user.id,
            installationId
          });
          
          const { data, error: updateError } = await supabase.functions.invoke('update-github-installation', {
            body: JSON.stringify({ userId: user.id, installationId }),
          });
          
          if (updateError) {
            console.error('GitHubAppSetup: Error from update-github-installation:', updateError);
            setProcessingInstallation(false);
            handleError(`Failed to save GitHub installation: ${updateError.message}`);
            return;
          }
          
          console.log('GitHubAppSetup: Edge function response:', data);
          console.log('GitHubAppSetup: Installation ID update requested via Edge Function.');
          
          // Refresh the profile ONCE to get the updated installation ID
          if (refreshProfile) {
            console.log('GitHubAppSetup: Calling refreshProfile to get updated installation ID.');
            await refreshProfile();
            // After this, useEffect will re-run. The condition above
            // (developerProfile?.github_installation_id === installationId) should eventually be met.
            console.log('GitHubAppSetup: refreshProfile call completed. Waiting for developerProfile update.');
          }
          // Do not setProcessingInstallation(false) here immediately, let the effect re-evaluate with new profile
          // Or, we can rely on the developerProfile change to trigger the success state.
          // For now, let's allow the effect to re-run and hit the success condition.
          
          // Clear URL parameters (moved to success block)
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('installation_id');
          cleanUrl.searchParams.delete('setup_action');
          cleanUrl.searchParams.delete('state'); 
          window.history.replaceState({}, '', cleanUrl.toString());
          
          setProcessingInstallation(false);
          
          if (setupAction === 'install') {
            console.log('GitHubAppSetup: GitHub App successfully installed');
            handleSuccess('GitHub App successfully installed and connected!');
          } else {
            handleSuccess('GitHub App connection updated successfully!');
          }
        } catch (err) {
          console.error('GitHubAppSetup: Error saving installation ID:', err);
          setProcessingInstallation(false);
          handleError(err instanceof Error ? err.message : 'Failed to save GitHub installation.');
        }
        return;
      } else if (user && installationId && processingInstallation) {
        console.log('GitHubAppSetup: Already processing installation, waiting for completion');
        setUiState('loading');
        setMessage('Processing GitHub App installation...');
        return;
      }

      // Scenario 2: User is logged in but no installation_id in URL
      if (user && !installationId) {
        console.log(`GitHubAppSetup: User ${user.id} present, but no installation_id in URL.`);
        console.log('GitHubAppSetup: Developer profile:', developerProfile);
        if (developerProfile) {
          console.log('GitHub handle:', developerProfile.github_handle || 'none');
          console.log('Installation ID:', developerProfile.github_installation_id || 'none');
        }
        
        // Check if developer profile has installation ID 
        const hasInstallationId = developerProfile?.github_installation_id && 
                                 developerProfile.github_installation_id !== '';
                                 
        console.log('GitHubAppSetup: Has installation ID:', hasInstallationId);
        if (hasInstallationId) {
          console.log('GitHubAppSetup: Developer profile already has an installation ID. GitHub App is connected.');
          handleSuccess('GitHub App is already connected!', 1500);
        } else {
          // Check if we need to wait for profile to load 
          if (!developerProfile && retryCount < maxRetries) {
            console.log('GitHubAppSetup: Waiting for developer profile to load...');
            console.log(`GitHubAppSetup: Retry attempt ${retryCount + 1}/${maxRetries}`);
            setUiState('loading'); 
            setMessage(`Loading your profile... (Attempt ${retryCount + 1}/${maxRetries})`); 
            
            // Increment retry count. DO NOT call refreshProfile here.
            // Wait for AuthContext to settle its loading state.
            setTimeout(() => {
              // if (refreshProfile) { // Removed refreshProfile call
              //  refreshProfile();
              // }
              console.log(`GitHubAppSetup: Incrementing retry count to ${retryCount + 1} while waiting for developer profile.`);
              setRetryCount(prev => prev + 1);
            }, 2000);
          } else {
            console.log('GitHubAppSetup: Developer profile not loaded after retries or no installation ID. Showing GitHub App connection info...');
            setUiState('info');
            setMessage('Connect the GitHub App to display your contributions and repositories.');
          }
        }
        return;
      }
      
      setUiState('loading');
      console.log('GitHubAppSetup: Default case - waiting for state to resolve');
      setMessage('Please wait...');
    };

    handleSetup();
  }, [user, developerProfile, authLoading, location.search, navigate, refreshProfile, 
      handleSuccess, handleError, redirectToGitHubAppInstall, retryCount, processingInstallation]);

  // Render the appropriate UI based on the current state
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" />
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
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500 mt-4">
              This allows us to sync your repository data and showcase your contributions.
            </p> 
          </div>
        )}

        {uiState === 'redirect' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">
              Please wait while we redirect you...
            </p>
          </div>
        )}

        {uiState === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500 mb-6">
              Redirecting you to your dashboard in a moment...
            </p> 
            <button
              onClick={() => navigate('/developer?tab=github-activity')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              Go to Dashboard
            </button> 
          </div>
        )}

        {(uiState === 'error' || uiState === 'info') && (
          <div className="text-center">
            {uiState === 'error' ? (
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-6" />
            ) : (
              <Github className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            )}
            <p className={`${uiState === 'error' ? 'text-red-600' : 'text-gray-700'} mb-6`}>{message}</p>
            
            {uiState === 'info' && (
              <div className="space-y-4 mb-4">
                <p className="text-sm text-gray-600 mb-6">
                  Connecting the GitHub App allows us to display your contributions, repositories, and coding activity.
                  This is a one-time setup process that securely connects your GitHub account.
                  <span className="block mt-2 text-xs text-gray-500">
                    {retryCount > 0 ? `Retry attempt ${retryCount} of ${maxRetries}` : 'No GitHub App connection detected'}
                  </span>
                </p>
                <button
                  onClick={redirectToGitHubAppInstall}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold mb-4 flex items-center justify-center"
                > 
                  <Github className="w-4 h-4 mr-2 inline" aria-hidden="true" />
                  Connect GitHub App Now
                </button>
                <button
                  onClick={() => navigate('/developer')}
                  className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  {uiState === 'error' ? 'Return to Dashboard' : 'Skip for Now'}
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
                    console.log('GitHubAppSetup: Refreshing profile after error');
                    setTimeout(() => {
                      if (developerProfile?.github_installation_id) {
                        handleSuccess('GitHub App is connected!');
                      } else {
                        setUiState('info'); 
                        setMessage('Connect your GitHub account to display your contributions and repositories.');
                      }
                    }, 2000);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Try Again
                </button>
              )}
              
              {uiState === 'error' && (
                <button
                  onClick={() => navigate('/developer')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium w-full"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
            
            {uiState === 'error' && (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium block mx-auto"
              >
                <RefreshCw className="w-4 h-4 mr-2 inline-block" aria-hidden="true" />
                Refresh Page
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};