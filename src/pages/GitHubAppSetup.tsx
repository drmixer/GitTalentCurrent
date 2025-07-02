import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Ensure this is the correct path to your useAuth hook
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, refreshProfile, loading: authLoading } = useAuth(); // Get authLoading state
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [installationIdFromUrl, setInstallationIdFromUrl] = useState<string | null>(null); // Renamed for clarity

  useEffect(() => {
    // If auth is still loading, wait for it
    if (authLoading) {
      return;
    }

    // If user is not authenticated, redirect to login
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Extract installation_id from URL query parameters
    const params = new URLSearchParams(location.search);
    const installation_id = params.get('installation_id');

    if (installation_id) {
      setInstallationIdFromUrl(installation_id);
      // We don't directly save it here anymore.
      // AuthContext's handleGitHubSignIn should have already processed it
      // from user_metadata during the OAuth callback.
      // We just need to ensure the profile is refreshed to pick up any changes.
      completeSetup();
    } else {
      // This path might be hit if the user manually navigates here
      // or if GitHub's redirect didn't include the ID for some reason.
      setLoading(false);
      setError('No GitHub App installation ID found in the URL. Please try connecting your GitHub account again.');
    }
  }, [location, user, navigate, refreshProfile, authLoading]); // Added authLoading to dependencies

  const completeSetup = async () => {
    try {
      setLoading(true);
      setError('');

      // Refresh the profile to ensure the latest data, including github_installation_id, is loaded
      // AuthContext's handleGitHubSignIn should have already processed and saved it
      // when the user signed in via GitHub OAuth.
      await refreshProfile();

      setSuccess(true);

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/developer', { replace: true });
      }, 2000);

    } catch (err: any) {
      console.error('Error completing GitHub App setup:', err);
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

        {/* Removed the display of installationIdFromUrl here, as it's an internal detail */}
      </div>
    </div>
  );
};
