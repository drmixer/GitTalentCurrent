import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase'; // Ensure this path is correct
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

const GITHUB_APP_SLUG = 'GitTalentApp';
const MAX_AUTH_RETRIES = 5; // Max retries for waiting on profile data in AuthContext

interface OAuthIntentData {
  name?: string;
  role?: string;
  install_after_auth?: boolean;
  // any other app-specific state you might have put in localStorage
}

export const AuthCallback: React.FC = () => {
  console.log('[AuthCallback] Component rendering. Top Level. Location Href:', window.location.href);

  const { user, userProfile, developerProfile, loading: authLoading, authError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'redirect' | 'info'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const [retryCount, setRetryCount] = useState(0);


  const redirectToGitHubAppInstall = useCallback(() => {
    if (!user?.id) {
      console.warn('[AuthCallback] redirectToGitHubAppInstall: No user ID available for GitHub App install redirect.');
      setMessage('Error: User ID not found. Please ensure you are logged in to connect the GitHub App.');
      setUiState('error');
      return;
    }
    const stateObj = {
      user_id: user.id,
      redirect_uri: `${window.location.origin}/github-setup`,
      from_auth_callback: true,
      timestamp: Date.now(),
    };
    const stateParam = encodeURIComponent(JSON.stringify(stateObj));
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}`;

    console.log('[AuthCallback] Redirecting to GitHub App installation:', githubAppInstallUrl);
    setUiState('redirect');
    setMessage('Redirecting to GitHub App installation...');
    window.location.href = githubAppInstallUrl;
  }, [user]); // Dependency: user

  useEffect(() => {
    console.log(`[AuthCallback] useEffect triggered. User: ${user?.id}, authLoading: ${authLoading}, userProfile: ${userProfile?.id}, devProfile loaded: ${developerProfile !== undefined}, retry: ${retryCount}`);
    let timeoutId: NodeJS.Timeout | undefined = undefined;

    if (authLoading && retryCount < MAX_AUTH_RETRIES && !user) { // Still waiting for initial user session from AuthContext
      console.log('[AuthCallback] Auth is loading (waiting for user session from AuthContext). Retry:', retryCount);
      setMessage(`Verifying your session (attempt ${retryCount + 1})...`);
      setUiState('loading');
      timeoutId = setTimeout(() => setRetryCount(prev => prev + 1), 1500);
      return () => clearTimeout(timeoutId);
    }

    if (!user && !authLoading) {
      console.error('[AuthCallback] No user session after AuthContext loading. Navigating to login.');
      setMessage('Authentication failed or session could not be established. Redirecting to login...');
      setUiState('error');
      timeoutId = setTimeout(() => navigate('/login', { replace: true }), 3000);
      return () => clearTimeout(timeoutId);
    }

    if (user && userProfile && !authLoading) { // User and main userProfile are loaded
      console.log('[AuthCallback] User and userProfile loaded.');
      const intentDataString = localStorage.getItem('oauth_intent_data');

      if (intentDataString) {
        localStorage.removeItem('oauth_intent_data'); // Crucial: Consume the intent data
        try {
          const intent: OAuthIntentData = JSON.parse(intentDataString);
          console.log('[AuthCallback] Retrieved and removed oauth_intent_data:', intent);

          if (intent.install_after_auth && userProfile.role === 'developer') {
            if (developerProfile === undefined && retryCount < MAX_AUTH_RETRIES) {
               console.log('[AuthCallback] Intent wants install. Developer profile still undefined. Waiting/retrying. Retry:', retryCount);
               setMessage('Finalizing developer profile setup...');
               setUiState('loading');
               timeoutId = setTimeout(() => {
                if(refreshProfile) refreshProfile();
                setRetryCount(prev => prev + 1);
               }, 1500);
               return () => clearTimeout(timeoutId);
            }

            if (developerProfile && developerProfile.github_installation_id) {
              console.log('[AuthCallback] Intent wants install, but developer already has GitHub App connected (ghInstId found in loaded devProfile). Proceeding to dashboard.');
            } else if (developerProfile === null || (developerProfile && !developerProfile.github_installation_id)) {
              console.log('[AuthCallback] Intent wants install. User is developer and needs app install (devProfile loaded but no ghInstId, or devProfile is explicitly null). Redirecting.');
              redirectToGitHubAppInstall();
              return;
            } else if (developerProfile === undefined && retryCount >= MAX_AUTH_RETRIES) { // Corrected line - removed stray backslash
                console.error('[AuthCallback] Intent wants install, but developerProfile is still undefined after retries. Cannot determine GitHub status. Proceeding to dashboard with potential issue.');
                setMessage('Could not fully verify GitHub connection status. Proceeding to dashboard.');
                setUiState('info');
            }
          } else {
            console.log('[AuthCallback] No install_after_auth intent, or user not developer, or other condition not met for app install redirect.', {intent, userProfileRole: userProfile?.role});
          }
        } catch (e) {
          console.error('[AuthCallback] Error parsing oauth_intent_data from localStorage:', e);
        }
      } else {
        console.log('[AuthCallback] No oauth_intent_data found in localStorage. Standard login/redirect.');
      }

      console.log('[AuthCallback] Proceeding to default dashboard navigation based on role.');
      setMessage('Authentication successful! Redirecting...');
      setUiState('success');
      const targetDashboard = userProfile.role === 'developer' ? '/developer'
                            : userProfile.role === 'recruiter' ? (userProfile.is_approved ? '/recruiter' : '/dashboard')
                            : userProfile.role === 'admin' ? '/admin'
                            : '/dashboard';
      console.log(`[AuthCallback] Navigating to ${targetDashboard}`);
      timeoutId = setTimeout(() => navigate(targetDashboard, { replace: true }), 1000);
      return () => clearTimeout(timeoutId);
    } else if (user && !userProfile && !authLoading && retryCount < MAX_AUTH_RETRIES) {
        console.log('[AuthCallback] User authenticated, but userProfile not yet available. Waiting/retrying. Retry:', retryCount);
        setMessage('Loading your profile details...');
        setUiState('loading');
        timeoutId = setTimeout(() => {
            if(refreshProfile) refreshProfile();
            setRetryCount(prev => prev + 1)
        }, 1500);
        return () => clearTimeout(timeoutId);
    } else if (!authLoading && user && !userProfile && retryCount >= MAX_AUTH_RETRIES) {
        console.error('[AuthCallback] User authenticated, but userProfile failed to load after retries. Navigating to generic dashboard.');
        setMessage('Failed to load your full profile details. Taking you to a general dashboard.');
        setUiState('error');
        timeoutId = setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
        return () => clearTimeout(timeoutId);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      console.log('[AuthCallback] useEffect cleanup.');
    };
  }, [user, authLoading, userProfile, developerProfile, navigate, redirectToGitHubAppInstall, retryCount, refreshProfile, location.search]);

  let iconToShow = <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />;
  if (uiState === 'success') iconToShow = <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />;
  if (uiState === 'error') iconToShow = <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />;
  if (uiState === 'redirect') iconToShow = <Github className="h-12 w-12 text-blue-600 mx-auto mb-4" />;
  if (uiState === 'info') iconToShow = <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          {iconToShow}
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          {uiState === 'loading' && 'Processing Authentication...'}
          {uiState === 'success' && 'Success!'}
          {uiState === 'error' && 'Error'}
          {uiState === 'redirect' && 'Redirecting to GitHub...'}
          {uiState === 'info' && 'Information'}
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        {authError && <p className="text-sm text-red-500 mt-2">Context Error: {authError}</p>}
        {(uiState === 'error' || (authLoading && retryCount >= MAX_AUTH_RETRIES && !user)) && (
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            Go to Login
          </button>
        )}
      </div>
    </div>
  );
};
