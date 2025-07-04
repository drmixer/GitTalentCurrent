import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader, CheckCircle, AlertCircle, Github } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');
    const error = params.get('error');
    
    // Handle errors first
    if (error) {
      setStatus('error');
      setMessage(`Authentication error: ${params.get('error_description') || error}`);
      return;
    }

    const processAuth = async () => {
      try {
        // If we have a code, the auth is being handled by Supabase auth
        if (code) {
          setMessage('Finalizing authentication...');
          
          // If we also have an installation_id, this is a GitHub App installation
          if (installationId) {
            setMessage('Connecting GitHub App...');
            
            // Wait for user to be available (auth to complete)
            if (!user) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              await refreshProfile();
            }
            
            // Redirect to GitHub setup page with the installation parameters
            navigate(`/github-setup?installation_id=${installationId}&setup_action=${setupAction || 'install'}&code=${code}`, { replace: true });
            return;
          }
          
          // Just authentication without app installation
          if (user) {
            setStatus('success');
            setMessage('Authentication successful!');
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1500);
          } else {
            // Wait a bit longer for auth to complete
            setTimeout(async () => {
              await refreshProfile();
              if (user) {
                setStatus('success');
                setMessage('Authentication successful!');
                setTimeout(() => {
                  navigate('/dashboard', { replace: true });
                }, 1500);
              } else {
                setStatus('error');
                setMessage('Authentication failed. Please try again.');
              }
            }, 3000);
          }
        } else {
          // No code parameter, something went wrong
          setStatus('error');
          setMessage('Invalid authentication callback. Missing parameters.');
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        setStatus('error');
        setMessage(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    processAuth();
  }, [user, navigate, location.search, refreshProfile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Github className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center text-gray-900 mb-6">
          {status === 'loading' && 'Processing Authentication'}
          {status === 'success' && 'Authentication Successful!'}
          {status === 'error' && 'Authentication Error'}
        </h1>

        {status === 'loading' && (
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirecting you to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};