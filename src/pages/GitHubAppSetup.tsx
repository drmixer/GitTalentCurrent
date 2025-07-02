import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase'; // Import supabase directly for this component
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [installationIdFromUrl, setInstallationIdFromUrl] = useState<string | null>(null);

  useEffect(() => {
    console.log('GitHubAppSetup useEffect - Current URL search params:', location.search); // Keep this log

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
    // Directly look for 'installation_id' from GitHub's redirect
    const installation_id = params.get('installation_id');
    const setup_action = params.get('setup_action');

    console.log('GitHubAppSetup useEffect - Found installation_id:', installation_id);
    console.log('GitHubAppSetup useEffect - Found setup_action:', setup_action);

    if (installation_id && setup_action === 'install') {
      setInstallationIdFromUrl(installation_id);
      console.log('GitHubAppSetup useEffect - Installation ID and setup_action found. Saving and completing setup...');
      saveInstallationIdAndCompleteSetup(installation_id); // Call new function
    } else if (setup_action === 'update') {
      console.log('GitHubAppSetup useEffect - Setup action is "update", refreshing profile.');
      // For updates, the ID might not be explicitly passed, just refresh profile
      completeSetup();
    } else {
      console.log('GitHubAppSetup useEffect - No valid installation ID or setup_action found in URL.');
      setLoading(false);
      setError('No GitHub App installation ID found in the URL. Please ensure you installed the app and try connecting your GitHub account again.');
    }
  }, [location, user, navigate, refreshProfile, authLoading]);

  // New function to directly save installation ID and then complete setup
  const saveInstallationIdAndCompleteSetup = async (id: string) => {
    try {
      setLoading(true);
      setError('');

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Directly update the developer profile with the installation ID
      const { error: updateError } = await supabase
        .from('developers')
        .update({ github_installation_id: id })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error saving GitHub installation ID directly:', updateError);
        throw updateError;
      }
      console.log('✅ GitHub installation ID saved directly to Supabase.');

      await completeSetup(); // Now proceed with the rest of the setup (profile refresh, redirect)

    } catch (err: any) {
      console.error('GitHubAppSetup Error saving installation ID and completing setup:', err);
      setError(err.message || 'Failed to save GitHub installation ID and complete setup');
    } finally {
      setLoading(false);
    }
  };


  const completeSetup = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('GitHubAppSetup completeSetup - Initiating profile refresh...');
      await refreshProfile(); // This will ensure AuthContext has the latest profile data

      setSuccess(true);
      console.log('GitHubAppSetup completeSetup - Setup successful, redirecting to dashboard...');
      setTimeout(() => {
        navigate('/developer', { replace: true });
      }, 2000);

    } catch (err: any) {
      console.error('GitHubAppSetup Error completing GitHub App setup:', err);
      setError(err.message || 'Failed to complete GitHub App setup');
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

        {error && (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-6">{error}</p>
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
