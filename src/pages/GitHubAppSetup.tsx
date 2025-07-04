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

  // Function to redirect to GitHub App installation
  const redirectToGitHubAppInstall = useCallback(() => {
    const GITHUB_APP_SLUG = 'gittalentapp'; // Your GitHub App slug
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
    
    console.log('GitHubAppSetup: Redirecting to GitHub App installation:', githubAppInstallUrl);
    window.location.href = githubAppInstallUrl;
  }, []);

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
      return;
    }
    
    // If no user and no means to get one (no oauthCode), redirect to login.
    if (!user && !oauthCode) {
      console.log('GitHubAppSetup: No user and no OAuth code, redirecting to login.');
      navigate('/login', { replace: true });
      return;
    }

    // At this point, if there was an oauthCode, AuthProvider should have processed it and `user` should be available.

    // Scenario 1: Combined OAuth + App Install OR App Install/Reconfigure for an existing user
    if (user && installationId) {
      setUiState('loading');
      setMessage('Connecting GitHub App...');
      console.log(`GitHubAppSetup: User ${user.id} present with installation_id ${installationId}. Action: ${setupAction}`);
      
      saveInstallationId(installationId, user.id)
        .then(() => {
          if (setupAction === 'install') {
            handleSuccess('GitHub App successfully installed and connected!');
          } else {
            handleSuccess('GitHub App connection updated successfully!');
          }
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('installation_id');
          cleanUrl.searchParams.delete('setup_action');
          cleanUrl.searchParams.delete('code');
          window.history.replaceState({}, '', cleanUrl.toString());
        })
        .catch(err => {
          handleError(err.message || 'Failed to save GitHub installation.');
        });
      return;
    }

    // Scenario 2: OAuth completed, user is present, but no installation_id in this redirect.
    if (user && oauthCode && !installationId) {
      console.log(`GitHubAppSetup: User ${user.id} present from OAuth, but no installation_id in this redirect.`);
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('code'); 
      window.history.replaceState({}, '', cleanUrl.toString());

      if (developerProfile?.github_installation_id) {
        console.log('GitHubAppSetup: Developer profile already has an installation ID. GitHub App is connected.');
        handleSuccess('GitHub account re-authenticated. App is already connected.', 1000);
      } else {
        console.log('GitHubAppSetup: Authentication successful. Redirecting to GitHub App installation...');
        // Instead of showing info message, automatically redirect to GitHub App installation
        redirectToGitHubAppInstall();
      }
      return;
    }
    
    // Scenario 3: User is logged in, no specific GitHub action parameters in URL
    if (user && !oauthCode && !installationId && !setupAction) {
      console.log(`GitHubAppSetup: User ${user.id} present, no specific GitHub action params.`);
      if (developerProfile?.github_installation_id) {
        handleSuccess('GitHub App is connected.', 1000);
      } else {
        console.log('GitHubAppSetup: No installation ID found. Redirecting to GitHub App installation...');
        redirectToGitHubAppInstall();
      }
      return;
    }
    
    setUiState('loading');
    setMessage('Please wait...');

  }, [
    user, 
    developerProfile, 
    authLoading, 
    location.search, 
    navigate, 
    refreshProfile, 
    handleSuccess, 
    handleError, 
    handleInfo,
    saveInstallationId,
    redirectToGitHubAppInstall
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
          {uiState === 'loading' && 'Connecting GitHub...'}
          {uiState === 'success' && 'GitHub Connected!'}
          {uiState === 'error' && 'Connection Error'}
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

        {uiState === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirecting you to your dashboard...
            </p>
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
            <button
              onClick={() => navigate('/developer?tab=github-activity')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-2 inline" aria-hidden="true" />
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};