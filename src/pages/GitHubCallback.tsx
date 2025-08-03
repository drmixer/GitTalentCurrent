import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader, AlertCircle, CheckCircle } from 'lucide-react';

export const GitHubCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, loading: authLoading, setResolvedDeveloperProfile } = useAuth();
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing GitHub App authorization...');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;
  const processingRef = useRef(false);

  useEffect(() => {
    const processGitHubCallback = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        // Extract parameters from URL
        const code = searchParams.get('code');
        const installationId = searchParams.get('installation_id');
        const stateParam = searchParams.get('state');
        
        console.log('[GitHubCallback] Processing callback with:', {
          code: code ? 'present' : 'missing',
          installationId,
          stateParam: stateParam ? 'present' : 'missing'
        });

        if (!code) {
          setStatus('error');
          setMessage('Missing authorization code from GitHub');
          return;
        }

        // Parse state parameter
        let stateData: any = {};
        if (stateParam) {
          try {
            stateData = JSON.parse(decodeURIComponent(stateParam));
          } catch (e) {
            console.warn('[GitHubCallback] Failed to parse state parameter:', e);
          }
        }

        // Get intent data from localStorage
        const intentDataString = localStorage.getItem('github_auth_intent');
        let intentData: any = {};
        if (intentDataString) {
          try {
            intentData = JSON.parse(intentDataString);
            localStorage.removeItem('github_auth_intent'); // Clean up
          } catch (e) {
            console.warn('[GitHubCallback] Failed to parse intent data:', e);
          }
        }

        setMessage('Exchanging authorization code for access token...');

        // Get Supabase URL from environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('Supabase URL not configured');
        }

        // Get Supabase anon key from environment variables
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseAnonKey) {
          throw new Error('Supabase anon key not configured');
        }

        // Call the new edge function to handle authentication and profile creation
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/github-auth-and-install`;
        console.log('[GitHubCallback] Calling edge function:', edgeFunctionUrl);

        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            code,
            installation_id: installationId,
            state: stateData,
            intent: intentData,
            redirect_uri: `${window.location.origin}/auth/github-callback`
          }),
        });

        console.log('[GitHubCallback] Edge function response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[GitHubCallback] Edge function error:', errorData);
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[GitHubCallback] Edge function result:', result);
        
        if (result.error) {
          throw new Error(result.error);
        }

        console.log('[GitHubCallback] GitHub auth successful:', result);

        setMessage('Authentication successful! Setting up your profile...');

        // Wait for AuthContext to process the new session
        if (result.session && result.user) {
          // The edge function should have created the Supabase session
          // Wait a moment for the auth state to propagate
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (result.developer_profile) {
            // Update the developer profile in AuthContext
            setResolvedDeveloperProfile(result.developer_profile);
          }

          setStatus('success');
          setMessage('Welcome to GitTalent! Redirecting to your dashboard...');
          
          // Redirect based on user role
          const targetPath = result.user.role === 'developer' ? '/developer' : '/dashboard';
          setTimeout(() => {
            navigate(targetPath, { replace: true });
          }, 2000);
        } else {
          throw new Error('Authentication succeeded but session was not created properly');
        }

      } catch (error: any) {
        console.error('[GitHubCallback] Error processing callback:', error);
        setStatus('error');
        setMessage(error.message || 'An unexpected error occurred during authentication');
        
        // Offer retry or redirect to login
        setTimeout(() => {
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setStatus('processing');
            setMessage(`Retrying authentication... (Attempt ${retryCount + 1}/${maxRetries})`);
            processingRef.current = false;
          } else {
            setMessage('Authentication failed after multiple attempts. Please try again.');
          }
        }, 3000);
      }
    };

    processGitHubCallback();
  }, [searchParams, navigate, setResolvedDeveloperProfile, retryCount]);

  const handleRetry = () => {
    setRetryCount(0);
    setStatus('processing');
    setMessage('Retrying GitHub authentication...');
    processingRef.current = false;
  };

  const handleReturnToLogin = () => {
    navigate('/login', { replace: true });
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader className="animate-spin h-12 w-12 text-blue-600" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-12 w-12 text-red-600" />;
      default:
        return <Loader className="animate-spin h-12 w-12 text-blue-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8 text-center">
          <div className="mb-6">
            {getStatusIcon()}
          </div>
          
          <h1 className={`text-2xl font-bold mb-4 ${getStatusColor()}`}>
            {status === 'processing' && 'Processing Authentication'}
            {status === 'success' && 'Authentication Successful!'}
            {status === 'error' && 'Authentication Failed'}
          </h1>
          
          <p className="text-gray-600 mb-6 leading-relaxed">
            {message}
          </p>

          {status === 'error' && retryCount >= maxRetries && (
            <div className="space-y-4">
              <button
                onClick={handleRetry}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleReturnToLogin}
                className="w-full py-3 px-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Return to Login
              </button>
            </div>
          )}

          {status === 'processing' && retryCount > 0 && (
            <div className="text-sm text-gray-500">
              Attempt {retryCount} of {maxRetries}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
