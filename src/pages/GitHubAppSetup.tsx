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
    console.log('GitHubAppSetup useEffect - Current URL search params:', location.search);

    if (authLoading) {
      console.log('GitHubAppSetup useEffect - Auth still loading, waiting...');
      return;
    }

    if (!user) {
      console.log('GitHubAppSetup useEffect - User not authenticated, redirecting to login.');
      navigate('/login', { replace: true });
      return;
    }

    const params = new URLSearchParams(location.search);
    const installation_id_param = params.get('installation_id');
    const setup_action = params.get('setup_action');

    const parsedInstallationId = installation_id_param ? parseInt(installation_id_param, 10) : null;
    const isValidInstallationId = parsedInstallationId !== null && !isNaN(parsedInstallationId);

    console.log('GitHubAppSetup useEffect - Found installation_id_param:', installation_id_param);
    console.log('GitHubAppSetup useEffect - Parsed installationId:', parsedInstallationId);
    console.log('GitHubAppSetup useEffect - Found setup_action:', setup_action);

    if (isValidInstallationId && setup_action === 'install') {
      setInstallationIdFromUrl(String(parsedInstallationId));
      console.log('GitHubAppSetup useEffect - Valid Installation ID and setup_action "install" found. Saving and completing setup...');
      saveInstallationIdAndCompleteSetup(String(parsedInstallationId));
    } else if (setup_action === 'update') {
      console.log('GitHubAppSetup useEffect - Setup action is "update", refreshing profile.');
      completeSetup();
    } else {
      // This path is hit if installation_id or setup_action are missing or invalid.
      // This is expected if the user just signed in via standard OAuth and hasn't installed the app yet.
      console.log('GitHubAppSetup useEffect - No valid installation ID or setup_action found in URL for installation. This is expected if only OAuth occurred.');
      setLoading(false);
      setIsError(false); // It's not an error, it's an instruction
      setMessage(
        "Account Successfully Authenticated! To connect and display your real GitHub activity, please proceed to the dashboard, go to the GitHub Activity tab and connect your account/give permissions."
      );
    }
  }, [location, user, navigate, refreshProfile, authLoading]);

  const saveInstallationIdAndCompleteSetup = async (id: string) => {
    try {
      setLoading(true);
      setMessage('');
      setIsError(false);

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error: updateError } = await supabase
        .from('developers')
        .update({ github_installation_id: id })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error saving GitHub installation ID directly:', updateError);
        throw updateError;
      }
      console.log('✅ GitHub installation ID saved directly to Supabase.');

      await completeSetup();

    } catch (err: any) {
      console.error('GitHubAppSetup Error saving installation ID and completing setup:', err);
      setMessage(err.message || 'Failed to save GitHub installation ID and complete setup');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };


  const completeSetup = async () => {
    try {
      setLoading(true);
      setMessage('');
      setIsError(false);
      console.log('GitHubAppSetup completeSetup - Initiating profile refresh...');
      await refreshProfile();

      setSuccess(true);
      console.log('GitHubAppSetup completeSetup - Setup successful, redirecting to dashboard...');
      setTimeout(() => {
        navigate('/developer', { replace: true });
      }, 2000);

    } catch (err: any) {
      console.error('GitHubAppSetup Error completing GitHub App setup:', err);
      setMessage(err.message || 'Failed to complete GitHub App setup');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center text-gray-900 mb-6">
          {loading ? 'Connecting GitHub...' :
            success ? 'GitHub Connected!' :
            'GitHub Connection'}
        </h1>

        {loading && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
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
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
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
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            ) : (
              <CheckCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            )}
            <p className={`${isError ? 'text-red-600' : 'text-gray-700'} mb-6`}>{message}</p>
            <button
              onClick={() => navigate('/developer')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-2 inline" />
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
