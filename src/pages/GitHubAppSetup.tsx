import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

// Ensure this slug matches your GitHub App's slug exactly (usually lowercase)
const GITHUB_APP_SLUG = 'gittalentapp';

export const GitHubAppSetup: React.FC = () => {
  const {
    user,
    developerProfile,
    loading: authLoading,
    refreshProfile, // Function to request AuthContext to re-fetch profiles
    setResolvedDeveloperProfile, // Function to directly set developer profile in AuthContext
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'info' | 'redirect'>('loading');
  const [message, setMessage] = useState('Initializing GitHub App connection...');
  
  // useRef to prevent multiple processing attempts or re-entrant calls
  const processingRef = useRef(false);
  // useRef to store the installationId from the URL to avoid re-processing on re-renders if URL doesn't change
  const installationIdRef = useRef<string | null>(null);

  const handleSuccess = useCallback((successMessage: string, navState?: object) => {
    setUiState('success');
    setMessage(successMessage);
    console.log('[GitHubAppSetup] Success:', successMessage, 'Navigating with state:', navState);
    setTimeout(() => {
      navigate('/developer?tab=github-activity', { 
        replace: true, 
        state: navState ? { ...navState, fromGitHubSetup: true, timestamp: Date.now() } : { fromGitHubSetup: true, timestamp: Date.now() }
      });
    }, 2000);
  }, [navigate]);

  const handleError = useCallback((errorMessage: string, isCritical: boolean = true) => {
    setUiState('error');
    setMessage(errorMessage);
    console.error('[GitHubAppSetup] Error:', errorMessage);
    if (!isCritical) processingRef.current = false; // Allow retry for non-critical errors
  }, []);

  const redirectToGitHubAppInstallPage = useCallback(() => {
    if (!user?.id) {
      handleError('You are not authenticated. Cannot initiate GitHub App installation.');
      return;
    }
    setUiState('redirect');
    setMessage('Redirecting to GitHub for App installation...');
    
    const stateObj = {
      user_id: user.id,
      // This redirect_uri is where GitHub will send you *after* you complete the installation on GitHub's site.
      // It should point back to this /github-setup page.
      redirect_uri: `${window.location.origin}/github-setup`, 
      timestamp: Date.now(),
    };
    const stateParam = encodeURIComponent(JSON.stringify(stateObj));
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}`;
    
    console.log('[GitHubAppSetup] Redirecting to GitHub App install URL:', githubAppInstallUrl);
    window.location.href = githubAppInstallUrl;
  }, [user, handleError]);

  useEffect(() => {
    console.log(`[GitHubAppSetup] useEffect triggered. AuthLoading: ${authLoading}, User: ${user?.id}, DevProfile: ${developerProfile?.github_installation_id}, ProcessingRef: ${processingRef.current}`);

    const searchParams = new URLSearchParams(location.search);
    const currentInstallationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action'); // 'install' or 'update'
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (processingRef.current && installationIdRef.current === currentInstallationId) {
      console.log('[GitHubAppSetup] Already processing this installation or no new installation ID. Skipping.');
      return;
    }

    if (errorParam) {
      handleError(`GitHub returned an error: ${errorDescription || errorParam}`);
      processingRef.current = false; // Allow potential retry by your action
      return;
    }

    if (authLoading) {
      setMessage('Verifying your session...');
      setUiState('loading');
      return; // Wait for auth context to load your and profiles
    }

    if (!user) {
      handleError('You are not authenticated. Redirecting to login.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }

    // You are authenticated. Now, handle logic based on URL parameters (installation_id).
    if (currentInstallationId) {
      if (processingRef.current && installationIdRef.current !== currentInstallationId) {
        console.log('[GitHubAppSetup] New installation ID detected, but still processing previous. This should not happen often. Resetting.');
        processingRef.current = false; // Reset if new ID came in while old one was stuck
      }
      
      if (!processingRef.current) {
        installationIdRef.current = currentInstallationId; // Store the ID we are about to process
        processingRef.current = true; // Mark as processing this specific installation ID
        setUiState('loading');
        setMessage(`Processing GitHub App connection (ID: ${currentInstallationId})...`);

        supabase.functions.invoke('update-github-installation', {
          body: { userId: user.id, installationId: currentInstallationId }, // Pass as object, Supabase client stringifies
        })
        .then(async ({ data: functionResponse, error: functionError }) => {
          if (functionError) {
            console.error('[GitHubAppSetup] Supabase function error:', functionError);
            handleError(`Failed to update GitHub connection: ${functionError.message}`);
            processingRef.current = false; // Allow retry on error
            installationIdRef.current = null;
            return;
          }

          console.log('[GitHubAppSetup] Supabase function response:', functionResponse);
          let updatedDevProfile = null;
          if (functionResponse) {
            // Adapt based on actual structure. Common patterns:
            if (Array.isArray(functionResponse) && functionResponse.length > 0) updatedDevProfile = functionResponse[0];
            else if (functionResponse.data && Array.isArray(functionResponse.data) && functionResponse.data.length > 0) updatedDevProfile = functionResponse.data[0];
            else if (functionResponse.data && typeof functionResponse.data === 'object') updatedDevProfile = functionResponse.data;
            else if (typeof functionResponse === 'object' && !Array.isArray(functionResponse)) updatedDevProfile = functionResponse;
          }

          if (updatedDevProfile && updatedDevProfile.user_id) {
            console.log('[GitHubAppSetup] Successfully updated developer profile from function:', updatedDevProfile);
            if (setResolvedDeveloperProfile) {
              setResolvedDeveloperProfile(updatedDevProfile); // Update AuthContext immediately
            } else {
              console.warn('[GitHubAppSetup] setResolvedDeveloperProfile is not available in AuthContext. Falling back to refreshProfile.');
              if (refreshProfile) await refreshProfile(); // Fallback to general refresh
            }
            
            // Clean URL parameters after successful processing
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('installation_id');
            cleanUrl.searchParams.delete('setup_action');
            cleanUrl.searchParams.delete('state');
            window.history.replaceState({}, '', cleanUrl.toString());
            
            const navState = {
                freshGitHubHandle: updatedDevProfile.github_handle,
                freshGitHubInstallationId: updatedDevProfile.github_installation_id,
                isFreshGitHubSetup: true,
            };
            handleSuccess(setupAction === 'install' ? 'GitHub App installed successfully!' : 'GitHub App connection updated!', navState);

          } else {
            console.warn('[GitHubAppSetup] Function response did not yield a valid developer profile or was empty. Attempting general refresh.');
            if (refreshProfile) await refreshProfile();
            handleError('Connection processed, but profile data update is pending. Please check your dashboard shortly.', false);
          }
        })
        .catch(error => {
          console.error('[GitHubAppSetup] Unexpected error invoking Supabase function:', error);
          handleError(`An unexpected error occurred: ${error.message}`);
          processingRef.current = false; // Allow retry
          installationIdRef.current = null;
        });
      } // end if !processingRef.current (for this installationId)
    } else {
      // No installation_id in URL. Check if app is already connected or prompt to install.
      if (developerProfile?.github_installation_id) {
        console.log('[GitHubAppSetup] No installation_id in URL, but developer profile has ghInstId. App already connected.');
        handleSuccess('GitHub App is already connected. Redirecting to dashboard...');
      } else {
        // Not yet connected, and not an auth callback with installation_id.
        // This is the state where you land on /github-setup directly or are sent here to start the process.
        console.log('[GitHubAppSetup] No installation_id in URL and no ghInstId in profile. Prompting to install.');
        setUiState('info');
        setMessage('Connect your GitHub account to GitTalent to showcase your activity and repositories.');
        // You will click button which calls redirectToGitHubAppInstallPage
      }
      processingRef.current = false; // Ensure processing is false if we land here without an ID
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, developerProfile, authLoading, location.search, navigate, refreshProfile, setResolvedDeveloperProfile, handleSuccess, handleError, redirectToGitHubAppInstallPage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl p-8 space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <Github className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-800">
          {uiState === 'loading' && 'Connecting to GitHub...'}
          {uiState === 'success' && 'GitHub Connection Successful!'}
          {uiState === 'error' && 'Connection Problem'}
          {uiState === 'redirect' && 'Redirecting to GitHub...'}
          {uiState === 'info' && 'Connect Your GitHub Account'}
        </h1>

        <p className="text-center text-gray-600 pb-2">
          {message}
        </p>

        {uiState === 'loading' && (
          <div className="flex justify-center py-4">
            <Loader className="animate-spin h-10 w-10 text-blue-600" />
          </div>
        )}

        {uiState === 'redirect' && (
          <div className="flex justify-center py-4">
            <Loader className="animate-spin h-10 w-10 text-blue-600" />
            <p className="text-sm text-gray-500 ml-3 self-center">Please wait...</p>
          </div>
        )}

        {uiState === 'success' && (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">You will be redirected shortly.</p>
          </div>
        )}

        {uiState === 'error' && (
          <div className="text-center py-4 space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <button
              onClick={() => {
                processingRef.current = false; // Allow re-initiation of logic
                installationIdRef.current = null;
                if (refreshProfile) refreshProfile(); // Attempt to refresh auth state
                // Trigger useEffect again by slightly changing search, or rely on state update if that's enough
                // A simple reload might be easiest for you if state is complex
                window.location.reload(); 
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center shadow-md hover:shadow-lg"
            >
              <RefreshCw size={18} className="mr-2" /> Try Again
            </button>
            <button
              onClick={() => navigate('/developer')}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {uiState === 'info' && (
           <div className="text-center py-4 space-y-4">
            <p className="text-sm text-gray-600">
              To complete your profile and showcase your GitHub activity, please connect the GitTalent GitHub App.
            </p>
            <button
              onClick={redirectToGitHubAppInstallPage}
              className="w-full px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold flex items-center justify-center shadow-md hover:shadow-lg"
            >
              <Github size={18} className="mr-2" /> Connect with GitHub
            </button>
            <button
              onClick={() => navigate('/developer')}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Skip for Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
