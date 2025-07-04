import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, developerProfile, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'info'>('loading');
  const [message, setMessage] = useState('Connecting GitHub...');

  const handleSuccess = useCallback((successMessage: string, redirectDelay: number = 2000) => {
    console.log('GitHubAppSetup: Success -', successMessage);
    setUiState('success');
    setMessage(successMessage);
    setTimeout(() => {
      navigate('/developer?tab=github-activity', { replace: true });
    }, redirectDelay);
  }, [navigate]);

  const handleError = useCallback((errorMessage: string) => {
    console.error('GitHubAppSetup: Error -', errorMessage);
    setUiState('error');
    setMessage(errorMessage);
  }, []);

  const handleInfo = useCallback((infoMessage: string) => {
    console.log('GitHubAppSetup: Info -', infoMessage);
    setUiState('info');
    setMessage(infoMessage);
  }, []);

  const saveInstallationId = useCallback(async (id: string, currentUserId: string) => {
    console.log(`GitHubAppSetup: Saving installation ID ${id} for user ${currentUserId}`);
    const { error: updateError } = await supabase
      .from('developers')
      .update({ github_installation_id: id })
      .eq('user_id', currentUserId);

    if (updateError) {
      throw new Error(`Failed to save GitHub installation ID: ${updateError.message}`);
    }
    console.log('GitHubAppSetup: GitHub installation ID saved successfully in DB.');
    // After saving, refresh profile to get the latest state including the new installation ID
    await refreshProfile();
  }, [refreshProfile]);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthCode = params.get('code');
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');

    console.log('GitHubAppSetup: URL params:', { oauthCode, installationId, setupAction, errorParam, errorDescription });

    // Immediately handle GitHub errors
    if (errorParam) {
      handleError(`GitHub Error: ${errorDescription || errorParam}`);
      return;
    }

    // If auth is still loading and there's no OAuth code to process, wait.
    // If there is an oauthCode, AuthProvider will handle it and update 'user' and 'authLoading'.
    if (authLoading && !oauthCode) {
      console.log('GitHubAppSetup: Auth context loading, waiting...');
      setUiState('loading');
      setMessage('Verifying authentication...');
      return;
    }

    // If there's an oauthCode, AuthProvider needs to process it.
    // We wait for 'user' to be populated by AuthProvider.
    if (oauthCode && !user) {
      console.log('GitHubAppSetup: OAuth code present, waiting for AuthProvider to establish session...');
      setUiState('loading');
      setMessage('Finalizing authentication...');
      // AuthProvider will eventually set the user or trigger an error.
      // The useEffect will re-run when 'user' or 'authLoading' changes.
      return;
    }

    // If no user and no means to get one (no oauthCode), redirect to login.
    if (!user && !oauthCode) {
      console.log('GitHubAppSetup: No user and no OAuth code, redirecting to login.');
      navigate('/login', { replace: true });
      return;
    }

    // At this point, if there was an oauthCode, AuthProvider should have processed it and `user` should be available.
    // Or, the user was already logged in.

    // Scenario 1: Combined OAuth + App Install OR App Install/Reconfigure for an existing user
    if (user && installationId) {
      setUiState('loading');
      setMessage('Connecting GitHub App...');
      console.log(`GitHubAppSetup: User ${user.id} present with installation_id ${installationId}. Action: ${setupAction}`);
      
      saveInstallationId(installationId, user.id)
        .then(() => {
          // The refreshProfile() called within saveInstallationId will update developerProfile.
          // We might want to wait for that update if further checks on developerProfile are needed here.
          // For now, assume it's updated for the success message.
          if (setupAction === 'install') {
            handleSuccess('GitHub App successfully installed and connected!');
          } else {
            handleSuccess('GitHub App connection updated successfully!');
          }
          // Clean installation_id and setup_action from URL after processing
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('installation_id');
          cleanUrl.searchParams.delete('setup_action');
          // Also clean 'code' if it was part of this redirect (combined flow)
          cleanUrl.searchParams.delete('code');
          window.history.replaceState({}, '', cleanUrl.toString());
        })
        .catch(err => {
          handleError(err.message || 'Failed to save GitHub installation.');
        });
      return;
    }

    // Scenario 2: OAuth completed, user is present, but no installation_id in this redirect.
    // This means the App was not installed in *this specific GitHub interaction*.
    if (user && oauthCode && !installationId) {
      console.log(`GitHubAppSetup: User ${user.id} present from OAuth, but no installation_id in this redirect.`);
      // AuthProvider has handled the code. The URL should be cleaned by AuthProvider or here.
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('code'); // Ensure code is removed
      window.history.replaceState({}, '', cleanUrl.toString());

      // Check if the app was already installed (e.g., user re-authed but app was already connected)
      if (developerProfile?.github_installation_id) {
        console.log('GitHubAppSetup: Developer profile already has an installation ID. GitHub App is connected.');
        handleSuccess('GitHub account re-authenticated. App is already connected.', 1000);
      } else {
        console.log('GitHubAppSetup: Authentication successful. GitHub App not yet installed.');
        handleInfo(
          "Authentication successful! To complete setup, please install the GitTalent GitHub App. You can usually do this from your dashboard or profile settings."
        );
      }
      return;
    }

    // Scenario 3: User is logged in, no specific GitHub action parameters in URL (e.g., direct navigation, or refresh after setup)
    if (user && !oauthCode && !installationId && !setupAction) {
      console.log(`GitHubAppSetup: User ${user.id} present, no specific GitHub action params.`);
      if (developerProfile?.github_installation_id) {
        handleSuccess('GitHub App is connected.', 1000);
      } else {
        // This case might occur if the user lands here after OAuth and URL cleaning, but before installing.
        handleInfo("Connect your GitHub App from the dashboard to see your activity.");
      }
      return;
    }

    // Fallback loading message if none of the conditions are met yet, but should be brief.
    setUiState('loading');
    setMessage('Please wait...');

  }, [
    user,
    developerProfile,
    authLoading,
    location.search, // React to full search string changes
    navigate,
    refreshProfile,
    handleSuccess,
    handleError,
    handleInfo,
    saveInstallationId
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center text-gray-900 mb-6">
          {loading ? 'Connecting GitHub...' :
            success ? 'GitHub Connected!' : 'GitHub Connection'}
        </h1>

        {loading && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600">
              Connecting your GitHub account to GitTalent...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This will allow us to showcase your repositories and contributions.
            </p>
          </div>
        )}

        {success && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600 mb-4">
              Your GitHub account has been successfully connected to GitTalent! 
            </p>
            <p className="text-sm text-gray-500">
              Redirecting you to your dashboard...
            </p>
          </div>
        )}

        {message && (
          <div className="text-center">
            {isError ? (
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" aria-hidden="true" />
            ) : (
              <CheckCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" aria-hidden="true" />
            )}
            <p className={`${isError ? 'text-red-600' : 'text-gray-700'} mb-6`}>{message}</p>
            <button
              onClick={() => navigate('/developer?tab=github-activity')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-2 inline" aria-hidden="true" />
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};