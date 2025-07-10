import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft, RefreshCw } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, developerProfile, refreshProfile, loading: authLoading, setResolvedDeveloperProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'info' | 'redirect'>('info');
  const [message, setMessage] = useState('Connecting GitHub...');
  const [processingInstallation, setProcessingInstallation] = useState(false);

  const redirectToGitHubAppInstall = useCallback(() => {
    const GITHUB_APP_SLUG = 'GitTalentApp';
    const stateObj = {
      redirect_uri: `${window.location.origin}/github-setup`,
      user_id: user?.id,
      timestamp: Date.now()
    };
    const state = encodeURIComponent(JSON.stringify(stateObj));
    const redirectUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${state}&redirect_uri=${redirectUrl}`;
    
    setUiState('redirect');
    setMessage('Redirecting to GitHub App installation page...');
    setTimeout(() => {
      window.location.href = githubAppInstallUrl;
    }, 1000);
  }, [user]);

  const handleSuccess = useCallback((
    successMessage: string,
    redirectDelay: number = 2000,
    navState?: { freshGitHubHandle?: string; freshGitHubInstallationId?: string | number; isFreshGitHubSetup?: boolean }
  ) => {
    setUiState('success');
    setMessage(successMessage);
    setTimeout(() => {
      navigate('/developer?tab=github-activity', {
        replace: true,
        state: navState
      });
    }, redirectDelay);
  }, [navigate]);

  const handleError = useCallback((errorMessage: string) => {
    console.error('[GitHubAppSetup] Error - ', errorMessage);
    setUiState('error');
    setMessage(errorMessage);
  }, []);

  useEffect(() => {
    console.log('[GitHubAppSetup] useEffect triggered. Current user:', user?.id, 'Params:', location.search);
    const handleSetup = async () => {
      const searchParams = new URLSearchParams(location.search);
      const installationId = searchParams.get('installation_id'); 
      const setupAction = searchParams.get('setup_action');
      const errorParam = searchParams.get('error'); 
      const errorDescription = searchParams.get('error_description'); 
      
      if (installationId || errorParam) {
        setRetryCount(0);
      }
  
      if (errorParam) {
        handleError(`GitHub Error: ${errorDescription || errorParam}`);
        return;
      }
  
      if (authLoading && !user) { // Only wait if user is not yet loaded
        if (retryCount >= maxRetries) {
          handleError('Authentication is taking too long. Please try logging in again.');
        } else {
          setUiState('loading');
          setMessage(`Verifying your session... (Attempt ${retryCount + 1}/${maxRetries})`);
          const timer = setTimeout(() => setRetryCount(prev => prev + 1), 2000);
          return () => clearTimeout(timer);
        }
        return;
      } 
  
      if (!user) {
        console.log('[GitHubAppSetup] No user session found. Redirecting to login.');
        navigate('/login', { replace: true });
        return;
      }
  
      if (user && installationId && developerProfile?.github_installation_id && String(developerProfile.github_installation_id) === String(installationId)) {
        console.log('[GitHubAppSetup] Installation ID already matches profile. Likely a refresh or re-config.');
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('installation_id');
        cleanUrl.searchParams.delete('setup_action');
        cleanUrl.searchParams.delete('state');
        window.history.replaceState({}, '', cleanUrl.toString());
        handleSuccess(setupAction === 'install' ? 'GitHub App successfully installed!' : 'GitHub App connection updated!', 1000, {
          freshGitHubHandle: developerProfile.github_handle,
          freshGitHubInstallationId: developerProfile.github_installation_id,
          isFreshGitHubSetup: true
        });
        return;
      } 
      
      if (user && installationId && !processingInstallation) {
        setProcessingInstallation(true);
        setUiState('loading');
        setMessage(`Connecting GitHub App... (Installation ID: ${installationId})`);
  
        try {
          const { data: functionResponse, error: functionError } = await supabase.functions.invoke('update-github-installation', {
            body: { userId: user.id, installationId: String(installationId) }, // Ensure installationId is string
          });

          if (functionError) {
            console.error('[GitHubAppSetup] Error invoking update-github-installation:', functionError);
            setProcessingInstallation(false);
            handleError(`Failed to save GitHub installation: ${functionError.message}`);
            return;
          }

          console.log('[GitHubAppSetup] Raw functionResponse from update-github-installation:', JSON.stringify(functionResponse));
          
          let freshDeveloperData = null;
          if (functionResponse) {
            if (Array.isArray(functionResponse)) {
                freshDeveloperData = functionResponse[0];
                 console.log('[GitHubAppSetup] functionResponse was an array, took first element.');
            } else if (functionResponse.data && typeof functionResponse.data === 'object') { // Check if .data exists and is an object
                if(Array.isArray(functionResponse.data)) {
                    freshDeveloperData = functionResponse.data[0];
                    console.log('[GitHubAppSetup] functionResponse.data was an array, took first element.');
                } else {
                    freshDeveloperData = functionResponse.data;
                    console.log('[GitHubAppSetup] Used functionResponse.data directly as it is an object.');
                }
            } else if (typeof functionResponse === 'object' && functionResponse !== null) {
                freshDeveloperData = functionResponse;
                console.log('[GitHubAppSetup] Used functionResponse directly as it is an object (and not array/no .data).');
            }
          }
          
          console.log('[GitHubAppSetup] Parsed freshDeveloperData:', JSON.stringify(freshDeveloperData));

          if (freshDeveloperData && typeof freshDeveloperData === 'object' && freshDeveloperData.user_id && setResolvedDeveloperProfile) {
            console.log('[GitHubAppSetup] Developer data from function seems valid, calling setResolvedDeveloperProfile.');
            setResolvedDeveloperProfile(freshDeveloperData as Developer);
          } else {
            console.warn('[GitHubAppSetup] Did not get valid fresh developer data from function to set in context. Attempting refreshProfile(). Parsed data:', freshDeveloperData);
            if (refreshProfile) await refreshProfile();
          }
          
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('installation_id');
          cleanUrl.searchParams.delete('setup_action');
          cleanUrl.searchParams.delete('state'); 
          window.history.replaceState({}, '', cleanUrl.toString());
          
          setProcessingInstallation(false);
          
          if (freshDeveloperData && freshDeveloperData.github_handle && freshDeveloperData.github_installation_id) {
            console.log(`[GitHubAppSetup] Navigating WITH state: handle=${freshDeveloperData.github_handle}, instId=${freshDeveloperData.github_installation_id}.`);
            handleSuccess(
              setupAction === 'install' ? 'GitHub App successfully installed and connected!' : 'GitHub App connection updated successfully!', 
              1000, 
              {
                freshGitHubHandle: freshDeveloperData.github_handle,
                freshGitHubInstallationId: freshDeveloperData.github_installation_id,
                isFreshGitHubSetup: true
              }
            );
          } else {
            console.warn('[GitHubAppSetup] Missing critical data from Edge Function for navState. Navigating WITHOUT state or with partial success.', freshDeveloperData);
            handleSuccess(setupAction === 'install' ? 'GitHub App installed (profile data may take a moment to update).' : 'GitHub App connection updated (profile data may take a moment to update).', 2000);
          }
        } catch (err: any) { 
          console.error('[GitHubAppSetup] Error processing GitHub installation (outer catch):', err.message ? err.message : err);
          setProcessingInstallation(false);
          handleError(err.message || 'Failed to process GitHub installation.');
        }
        return; 

      } else if (user && installationId && processingInstallation) {
        setUiState('loading');
        setMessage('Processing GitHub App installation...');
        return;
      }

      if (user && !installationId) {
        console.log('[GitHubAppSetup] No installation_id in URL. Checking current developer profile state.');
        const hasInstallationId = developerProfile?.github_installation_id && String(developerProfile.github_installation_id).length > 0;
                                 
        if (hasInstallationId) {
          handleSuccess('GitHub App is already connected! Redirecting to dashboard...', 1000, {
             freshGitHubHandle: developerProfile.github_handle,
             freshGitHubInstallationId: developerProfile.github_installation_id,
             isFreshGitHubSetup: false // Not a fresh setup, but data is present
          });
        } else {
          if (developerProfile === undefined && retryCount < maxRetries && !authLoading) { // developerProfile might not be loaded yet from AuthContext
            setUiState('loading'); 
            setMessage(`Loading your profile to check GitHub status... (Attempt ${retryCount + 1}/${maxRetries})`); 
            const timer = setTimeout(() => {
              if(refreshProfile) refreshProfile();
              setRetryCount(prev => prev + 1);
            }, 1500);
            return () => clearTimeout(timer);
          } else if (developerProfile === null || (developerProfile && !developerProfile.github_installation_id)) {
            setUiState('info');
            setMessage('Connect the GitHub App to display your contributions and repositories.');
          } else if (developerProfile === undefined && (authLoading || retryCount >= maxRetries)) {
             handleError('Could not load your profile to check GitHub status. Please try again or return to dashboard.');
          } else {
            setUiState('info'); // Default info state if other conditions not met
            setMessage('Checking GitHub connection status...');
          }
        }
        return;
      }
      
      // Default state if none of the above conditions are met (e.g. unexpected URL state)
      if (!installationId) {
        console.log('[GitHubAppSetup] No installation ID in URL and not an existing connection. Showing info.');
        setUiState('info');
        setMessage('Ready to connect your GitHub account.');
      }
    };

    handleSetup();
  }, [user, developerProfile, authLoading, location.search, navigate, refreshProfile, 
      handleSuccess, handleError, processingInstallation, retryCount, setResolvedDeveloperProfile, redirectToGitHubAppInstall]);

  // UI Rendering
  let iconToShow = <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />;
  if (uiState === 'success') iconToShow = <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />;
  if (uiState === 'error') iconToShow = <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />;
  if (uiState === 'redirect') iconToShow = <Github className="h-12 w-12 text-blue-600 mx-auto mb-4" />;
  if (uiState === 'info') iconToShow = <Github className="h-12 w-12 text-gray-400 mx-auto mb-4" />;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          {iconToShow}
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          {uiState === 'loading' && 'Connecting GitHub...'}
          {uiState === 'success' && 'GitHub Connected!'}
          {uiState === 'error' && 'Connection Error'}
          {uiState === 'redirect' && 'Redirecting to GitHub...'}
          {uiState === 'info' && 'Connect to GitHub'}
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        
        {uiState === 'info' && (
          <button
            onClick={redirectToGitHubAppInstall}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center"
            disabled={authLoading || !user}
          >
            <Github className="w-5 h-5 mr-2" />
            Connect GitHub App
          </button>
        )}

        {(uiState === 'error') && (
          <div className="space-y-3 mt-6">
            <button
              onClick={() => {
                setRetryCount(0); // Reset retries
                if(refreshProfile) refreshProfile();
                // The useEffect will re-trigger handleSetup
                setUiState('loading');
                setMessage('Retrying connection...');
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
            <button
              onClick={() => navigate('/developer')}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}
         {(authLoading && retryCount >= maxRetries && uiState !== 'error') && (
            <p className="text-sm text-orange-600 mt-4">Authentication is taking a while. If this persists, please try returning to the dashboard and connecting from your profile settings.</p>
        )}
      </div>
    </div>
  );
};
