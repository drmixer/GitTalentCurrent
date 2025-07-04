import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [installationIdFromUrl, setInstallationIdFromUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const installation_id_param = params.get('installation_id');
    const setup_action = params.get('setup_action');
    const code_param = params.get('code');
    
    console.log('GitHubAppSetup useEffect - URL params:', { 
      installation_id: installation_id_param,
      setup_action,
      code: code_param ? 'present' : 'absent'
    });

    if (authLoading) {
      console.log('GitHubAppSetup useEffect - Auth still loading, waiting...');
      return;
    }

    // If we have a code but no user yet, wait a bit longer
    if (!user && code_param) {
      console.log('GitHubAppSetup useEffect - Have code but no user yet, waiting...');
      setTimeout(() => {
        refreshProfile();
      }, 2000);
      return;
    } else if (!user) {
      console.log('GitHubAppSetup useEffect - User not authenticated, redirecting to login.');
      navigate('/login', { replace: true });
      return;
    }

    const parsedInstallationId = installation_id_param ? parseInt(installation_id_param, 10) : null; 
    const isValidInstallationId = parsedInstallationId !== null && !isNaN(parsedInstallationId);

    console.log('GitHubAppSetup useEffect - Found installation_id_param:', installation_id_param);
    console.log('GitHubAppSetup useEffect - Parsed installationId:', parsedInstallationId);
    console.log('GitHubAppSetup useEffect - Found setup_action:', setup_action);

    // If we have a valid installation ID, save it
    if (isValidInstallationId) {
      setInstallationIdFromUrl(String(parsedInstallationId));
      console.log('GitHubAppSetup useEffect - Valid Installation ID found:', parsedInstallationId);
      
      if (setup_action === 'install') {
        console.log('GitHubAppSetup useEffect - Setup action is "install", saving installation ID...');
        saveInstallationIdAndCompleteSetup(String(parsedInstallationId));
      } else {
        console.log('GitHubAppSetup useEffect - No setup_action "install", but saving installation ID anyway...');
        saveInstallationIdAndCompleteSetup(String(parsedInstallationId));
      }
    } else if (setup_action === 'update') {
      console.log('GitHubAppSetup useEffect - Setup action is "update", refreshing profile.'); 
      completeSetup();
    } else if (code_param) {
      // This is the OAuth redirect, but no installation_id yet
      console.log('GitHubAppSetup useEffect - Found code parameter, completing authentication...');
      
      // Just show success message and redirect to dashboard
      setLoading(false);
      setIsError(false);
      setSuccess(true);
      setMessage(
        "Account Successfully Authenticated! You'll now be redirected to the GitHub Activity tab where you can connect the GitHub App to display your contributions."
      );
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/developer?tab=github-activity', { replace: true });
      }, 3000);
    } else {
      // This path is hit if installation_id or setup_action are missing or invalid.
      // This is expected if the user just signed in via standard OAuth and hasn't installed the app yet.
      console.log('GitHubAppSetup useEffect - No valid installation ID or setup_action found in URL for installation. This is expected if only OAuth occurred.');
      setLoading(false);
      setIsError(false); // It's not an error, it's an instruction
      setMessage(
        "Account Successfully Authenticated! To connect and display your real GitHub activity, please proceed to the dashboard, go to the GitHub Activity tab and connect your account/give permissions."
      );
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/developer?tab=github-activity', { replace: true });
      }, 3000);
    }
  }, [location, user, navigate, refreshProfile, authLoading]);

  const saveInstallationIdAndCompleteSetup = async (id: string) => {
    try {
      setLoading(true);
      setMessage('');
      setIsError(false);
      
      if (!user) {
        console.error('GitHubAppSetup saveInstallationIdAndCompleteSetup - No user found');
        throw new Error('User not authenticated');
      }

      console.log('GitHubAppSetup saveInstallationIdAndCompleteSetup - Saving installation ID:', id, 'for user:', user.id);
      
      const { error: updateError } = await supabase
        .from('developers')
        .update({ github_installation_id: id })
        .eq('user_id', user.id); 

      if (updateError) {
        console.error('GitHubAppSetup saveInstallationIdAndCompleteSetup - Error saving GitHub installation ID:', updateError);
        throw updateError;
      }
      console.log('GitHubAppSetup saveInstallationIdAndCompleteSetup - GitHub installation ID saved successfully');

      await completeSetup();

    } catch (err: any) {
      console.error('GitHubAppSetup Error saving installation ID and completing setup:', err);
      setMessage(err.message || 'Failed to save GitHub installation ID and complete setup');
      setIsError(true);
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    try {
      setLoading(true);
      setMessage('');
      setIsError(false);
      
      console.log('GitHubAppSetup completeSetup - Initiating profile refresh for user:', user?.id); 
      await refreshProfile();

      setSuccess(true);
      console.log('GitHubAppSetup completeSetup - Setup successful, redirecting to dashboard...');
      
      // Set success message
      setMessage("GitHub App successfully connected! You'll now be redirected to your dashboard.");
      setLoading(false);
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/developer?tab=github-activity', { replace: true });
      }, 2000);

    } catch (err: any) {
      console.error('GitHubAppSetup Error completing GitHub App setup:', err);
      setMessage(err.message || 'Failed to complete GitHub App setup');
      setIsError(true);
      setLoading(false);
    }
  };

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
              {installationIdFromUrl ? 'Connecting your GitHub App to GitTalent...' : 'Processing your GitHub authentication...'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This will allow us to showcase your repositories and contributions.
            </p>
          </div>
        )}

        {success && !message && (
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