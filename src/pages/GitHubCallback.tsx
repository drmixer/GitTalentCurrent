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
  const [hasProcessed, setHasProcessed] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    // Clean up URL immediately to prevent reprocessing
    const code = searchParams.get('code');
    const installationId = searchParams.get('installation_id');
    const stateParam = searchParams.get('state');

    // Clear URL parameters immediately to prevent re-runs
    if (code && !hasProcessed) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const processGitHubCallback = async () => {
      // Prevent multiple processing attempts
      if (processedRef.current || hasProcessed) {
        console.log('[GitHubCallback] Already processed, skipping');
        return;
      }

      processedRef.current = true;
      setHasProcessed(true);

      try {
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
            localStorage.removeItem('github_auth_intent'); // Clean up immediately
          } catch (e) {
            console.warn('[GitHubCallback] Failed to parse intent data:', e);
          }
        }

        setMessage('Exchanging authorization code for access token...');

        // Get Supabase configuration
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase configuration missing');
        }

        // Call the edge function
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

        // Handle the response based on whether we got a session
        if (result.session && result.user) {
          // We have a valid session, set up the user
          console.log('[GitHubCallback] Session received, setting up user');
          
          if (result.developer_profile) {
            setResolvedDeveloperProfile(result.developer_profile);
          }

          setStatus('success');
          setMessage('Welcome to GitTalent! Redirecting to your dashboard...');
          
          // Redirect based on user role
          const targetPath = result.user.role === 'developer' ? '/developer' : '/dashboard';
          setTimeout(() => {
            navigate(targetPath, { replace: true });
          }, 2000);

        } else if (result.user && result.message) {
          // User was created but no session was provided
          console.log('[GitHubCallback] User created but no session, redirecting to login');
          
          setStatus('success');
          setMessage('Account created successfully! Please sign in with your email to continue.');
          
          // Store user info for potential auto-fill on login page
          sessionStorage.setItem('github_auth_email', result.user.email);
          
          setTimeout(() => {
            navigate('/login?message=Please sign in with your email to complete setup', { replace: true });
          }, 3000);

        } else {
          throw new Error('Unexpected response format from authentication service');
        }

      } catch (error: any) {
        console.error('[GitHubCallback] Error processing callback:', error);
        setStatus('error');
        
        // Handle specific error cases
        if (error.message.includes('code passed is incorrect or expired')) {
          setMessage('The GitHub authorization code has expired. Please try signing in again.');
        } else if (error.message.includes('already registered')) {
          setMessage('This GitHub account is already registered. Please sign in with your email.');
          setTimeout(() => {
            navigate('/login?message=Account already exists, please sign in', { replace: true });
          }, 3000);
          return;
        } else {
          setMessage(error.message || 'An unexpected error occurred during authentication');
        }
      }
    };

    // Only process if we have a code and haven't processed yet
    if (code && !hasProcessed) {
      processGitHubCallback();
    }
  }, []); // Empty dependency array to run only once

  const handleRetry = () => {
    setStatus('processing');
    setMessage('Redirecting to GitHub for authentication...');
    
    // Clear any stored state and redirect to start over
    localStorage.removeItem('github_auth_intent');
    sessionStorage.removeItem('github_auth_email');
    
    // Redirect to login page to start the flow again
    navigate('/login', { replace: true });
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

          {status === 'error' && (
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
        </div>
      </div>
    </div>
  );
};
