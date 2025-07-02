import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft } from 'lucide-react';

export const GitHubAppSetup = () => {
  const { user, developerProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [installationId, setInstallationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Extract installation_id from URL query parameters
    const params = new URLSearchParams(location.search);
    const installation_id = params.get('installation_id');
    
    if (installation_id) {
      setInstallationId(installation_id);
      saveInstallationId(installation_id);
    } else {
      setLoading(false);
      setError('No installation ID found in the URL. Please try connecting your GitHub account again.');
    }
  }, [location, user]);

  const saveInstallationId = async (installationId: string) => {
    try {
      setLoading(true);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Update the developer profile with the installation ID
      const { error } = await supabase
        .from('developers')
        .update({ github_installation_id: installationId })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Refresh the profile to get the updated data
      await refreshProfile();
      
      setSuccess(true);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/developer', { replace: true });
      }, 2000);
      
    } catch (err: any) {
      console.error('Error saving GitHub installation ID:', err);
      setError(err.message || 'Failed to save GitHub installation ID');
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
        
        {installationId && !loading && !error && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">
              Installation ID: <span className="font-mono text-xs">{installationId}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};