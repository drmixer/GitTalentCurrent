import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft, RefreshCw } from 'lucide-react';
import { Developer } from '../types'; // Ensure Developer type is imported

export const GitHubAppSetup: React.FC = () => {
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
  
      // Scenario 1: App Install/Reconfigure for an existing user, and ID already matches context
      if (user && installationId && developerProfile?.github_installation_id && String(developerProfile.github_installation_id) === String(installationId)) {
        console.log('[GitHubAppSetup] Installation ID from URL already matches developerProfile in context. Likely a refresh or re-config.');
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('installation_id');
        cleanUrl.searchParams.delete('setup_action');
        cleanUrl.searchParams.delete('state');
        window.history.replaceState({}, '', cleanUrl.toString());
        handleSuccess(setupAction === 'install' ? 'GitHub App successfully installed!' : 'GitHub App connection updated!', 1000, {
          freshGitHubHandle: developerProfile.github_handle,
          freshGitHubInstallationId: developerProfile.github_installation_id,
          isFreshGitHubSetup: true // Treat as fresh setup to ensure data reload with potentially new permissions
        });
        return;
      } 
      
      // Scenario 2: New installation or ID mismatch - process the installationId from URL
      if (user && installationId && !processingInstallation) {
        setProcessingInstallation(true);
        setUiState('loading');
        setMessage(`Connecting GitHub App... (Installation ID: ${installationId})`);
  
        try {
          const { data: functionResponse, error: functionError } = await supabase.functions.invoke('update-github-installation', {
            body: { userId: user.id, installationId: String(installationId) }, 
          });

          if (functionError) {
            console.error('[GitHubAppSetup] Error invoking update-github-installation:', functionError);
            setProcessingInstallation(false);
            handleError(`Failed to save GitHub installation: ${functionError.message}`);
            return;
          }

          console.log('[GitHubAppSetup] Raw functionResponse from update-github-installation:', JSON.stringify(functionResponse));
          
          let freshDeveloperData: Developer | null = null;
          // Correctly parse the Edge Function response which might be nested
          if (functionResponse && functionResponse.data && typeof functionResponse.data === 'object') {
            freshDeveloperData = functionResponse.data as Developer;
            console.log('[GitHubAppSetup] Used functionResponse.data as freshDeveloperData.');
          } else if (functionResponse && typeof functionResponse === 'object' && !Array.isArray(functionResponse)) {
            freshDeveloperData = functionResponse as Developer; // Fallback if data is not in a 'data' property but is an object
            console.log('[GitHubAppSetup] Used functionResponse directly as freshDeveloperData.');
          } else {
            console.warn('[GitHubAppSetup] functionResponse.data was not the expected object or functionResponse itself was not an object. Full response:', functionResponse);
          }
          
          console.log('[GitHubAppSetup] Parsed freshDeveloperData:', JSON.stringify(freshDeveloperData));

          if (freshDeveloperData && typeof freshDeveloperData === 'object' && freshDeveloperData.user_id && setResolvedDeveloperProfile) {
            console.log('[GitHubAppSetup] Developer data from function seems valid, calling setResolvedDeveloperProfile.');
            setResolvedDeveloperProfile(freshDeveloperData);
          } else {
            console.warn('[GitHubAppSetup] Did not get valid fresh developer data from function to set in context. Attempting refreshProfile(). Parsed data:', freshDeveloperData);
            if (refreshProfile) await refreshProfile(); // Refresh context to get latest from DB if function response was weird
          }
          
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('installation_id');
          cleanUrl.searchParams.delete('setup_action');
          cleanUrl.searchParams.delete('state'); 
          window.history.replaceState({}, '', cleanUrl.toString());
          
          setProcessingInstallation(false);
          
          // Use freshDeveloperData for navigation if available and valid
          if (freshDeveloperData && freshDeveloperData.github_handle && freshDeveloperData.github_installation_id) {
            console.log(`[GitHubAppSetup] Navigating WITH state from freshDeveloperData: handle=${freshDeveloperData.github_handle}, instId=${freshDeveloperData.github_installation_id}.`);
            handleSuccess(
              setupAction === 'install' ? 'GitHub App successfully installed and connected!' : 'GitHub App connection updated successfully!', 
              1000, 
              {
                freshGitHubHandle: freshDeveloperData.github_handle,
                freshGitHubInstallationId: freshDeveloperData.github_installation_id,
                isFreshGitHubSetup: true
              }
            );
          } else if (developerProfile && developerProfile.github_handle && developerProfile.github_installation_id) {
            // Fallback to context developerProfile if freshDeveloperData was incomplete but context has been updated by refreshProfile
            console.warn(`[GitHubAppSetup] freshDeveloperData incomplete. Falling back to context developerProfile for navState: handle=${developerProfile.github_handle}, instId=${developerProfile.github_installation_id}.`);
            handleSuccess(
              setupAction === 'install' ? 'GitHub App successfully installed!' : 'GitHub App connection updated!', 
              1000, 
              {
                freshGitHubHandle: developerProfile.github_handle,
                freshGitHubInstallationId: developerProfile.github_installation_id,
                isFreshGitHubSetup: true 
              }
            );
          }else {
            console.error('[GitHubAppSetup] Critical data (handle/installationId) missing from Edge Function and context. Navigating WITHOUT state.');
            handleError('Failed to retrieve all necessary GitHub connection details. Please check your profile or try reconnecting.');
            // Fallback to dashboard without state, user might need to manually check/connect again from profile
            // setTimeout(() => navigate('/developer', { replace: true }), 3000);
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

      // Scenario 3: User is logged in but no installation_id in URL (e.g. user revisits /github-setup or was sent by AuthCallback)
      if (user && !installationId) {
        console.log('[GitHubAppSetup] No installation_id in URL. Assessing current state.');
        const hasInstallationIdInContext = developerProfile?.github_installation_id && String(developerProfile.github_installation_id).length > 0;
                                 
        if (hasInstallationIdInContext) {
          console.log('[GitHubAppSetup] User already has installation ID in context. App should be connected.');
          handleSuccess('GitHub App is already connected! Redirecting to dashboard...', 1000, {
             freshGitHubHandle: developerProfile!.github_handle, // Assert non-null as hasInstallationIdInContext implies devProfile exists
             freshGitHubInstallationId: developerProfile!.github_installation_id,
             isFreshGitHubSetup: false 
          });
        } else {
          // developerProfile might be undefined (still loading from AuthContext), null (no record in DB), or present but without ghInstId.
          if (developerProfile === undefined && retryCount < maxRetries && !authLoading) {
            setUiState('loading'); 
            setMessage(`Loading your profile to check GitHub status... (Attempt ${retryCount + 1}/${maxRetries})`); 
            const timer = setTimeout(() => {
              if(refreshProfile) refreshProfile();
              setRetryCount(prev => prev + 1);
            }, 1500);
            return () => clearTimeout(timer);
          } else if (developerProfile === null || (developerProfile && !developerProfile.github_installation_id)) {
            console.log('[GitHubAppSetup] No installation ID found in profile. Prompting user to connect.');
            setUiState('info');
            setMessage('Connect the GitHub App to display your contributions and repositories.');
          } else if (developerProfile === undefined && (authLoading || retryCount >= maxRetries)) {
             handleError('Could not load your profile to check GitHub status. Please try again or return to dashboard.');
          } else {
            console.log('[GitHubAppSetup] Fallback: No installation ID in URL, unknown developer profile state. Prompting to connect.');
            setUiState('info'); 
            setMessage('Ready to connect your GitHub account.');
          }
        }
        return;
      }
      
      // Fallback if no specific conditions met (should be rare)
      if (!installationId) {
        console.log('[GitHubAppSetup] Defaulting to info state as no installation ID and other conditions not met.');
        setUiState('info');
        setMessage('Ready to connect your GitHub account.');
      }
    };

    handleSetup();
  }, [
    user, 
    developerProfile, 
    authLoading, 
    location.search, 
    navigate, 
    refreshProfile, 
    handleSuccess, 
    handleError, 
    processingInstallation, 
    retryCount, 
    setResolvedDeveloperProfile, 
    redirectToGitHubAppInstall
  ]);

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
            disabled={authLoading || !user} // Disable if auth is loading or no user
          >
            <Github className="w-5 h-5 mr-2" />
            Connect GitHub App
          </button>
        )}

        {(uiState === 'error') && (
          <div className="space-y-3 mt-6">
            <button
              onClick={() => {
                setRetryCount(0); 
                if(refreshProfile) refreshProfile();
                setUiState('loading');
                setMessage('Retrying connection...');
                // The useEffect will re-trigger handleSetup due to state change or refreshed profile data
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
