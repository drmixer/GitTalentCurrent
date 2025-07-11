import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader } from 'lucide-react';

// GitHub App slug - must match exactly what's configured in GitHub
const GITHUB_APP_SLUG = 'gittalentapp'; // Ensure this is correct (lowercase often preferred for slugs)

interface OAuthIntentData {
  name?: string;
  role?: string;
  install_after_auth?: boolean;
  [key: string]: any;
}

export const AuthCallback: React.FC = () => {
  const {
    user, // Supabase auth user
    userProfile, // Profile from 'users' table
    developerProfile, // Profile from 'developers' table
    loading: authContextLoading,
    authError,
    refreshProfile, // Function to manually trigger profile refresh in AuthContext
  } = useAuth();

  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Processing authentication...');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 8; // Increased max retries
  const processingRef = useRef(false); // To prevent multiple processing attempts

  const redirectToGitHubAppInstall = useCallback(() => {
    if (!user?.id) {
      setStatusMessage('Error: User ID not available for GitHub App installation.');
      console.warn('[AuthCallback] redirectToGitHubAppInstall: No user ID available.');
      return;
    }
    setStatusMessage('Redirecting to GitHub App installation...');
    const stateObj = {
      user_id: user.id,
      // The redirect_uri for GitHub App install is where GitHub sends you *after* you install/authorize the app.
      // This should point to your /github-setup page.
      redirect_uri: `${window.location.origin}/github-setup`,
      from_auth_callback: true, // Indicate origin
      timestamp: Date.now(),
    };
    const stateParam = encodeURIComponent(JSON.stringify(stateObj));
    // You are sent to GitHub to install the app. GitHub then sends you to the redirect_uri specified here.
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}`;
    console.log('[AuthCallback] Redirecting to GitHub App Install URL:', githubAppInstallUrl);
    window.location.href = githubAppInstallUrl;
  }, [user]);

  useEffect(() => {
    console.log(`[AuthCallback] useEffect triggered. AuthContext loading: ${authContextLoading}, User: ${user?.id}, UserProfile: ${userProfile?.id}, DeveloperProfile: ${developerProfile?.user_id} (ghInstId: ${developerProfile?.github_installation_id}), Retry: ${retryCount}`);

    if (processingRef.current) {
      console.log('[AuthCallback] Already processing, skipping this run.');
      return;
    }

    if (authError) {
      setStatusMessage(`Authentication error: ${authError}`);
      console.error('[AuthCallback] Auth error from context:', authError);
      processingRef.current = false; // Allow retry if error clears
      return;
    }

    // Wait for AuthContext to finish loading the initial user session and essential profiles.
    if (authContextLoading) {
      setStatusMessage('Waiting for authentication context to initialize...');
      console.log('[AuthCallback] AuthContext is loading. Waiting...');
      return; // Wait for authContextLoading to be false
    }

    // At this point, authContextLoading is false.
    // We must have a Supabase user object to proceed.
    if (!user) {
      setStatusMessage('No active user session. Redirecting to login.');
      console.log('[AuthCallback] No Supabase user found after AuthContext loaded. Redirecting to /login.');
      navigate('/login', { replace: true });
      return;
    }

    // User object exists. Now check for userProfile (from 'users' table).
    // If userProfile is still missing, it might be due to propagation delays or an issue in AuthContext.
    if (!userProfile) {
      if (retryCount < maxRetries) {
        setStatusMessage(`Waiting for your profile to load (Attempt ${retryCount + 1}/${maxRetries})...`);
        console.log(`[AuthCallback] User exists, but userProfile not yet available. Retrying... (Attempt ${retryCount + 1})`);
        // Attempt to refresh profile from AuthContext, then wait for next effect run via timeout.
        if (refreshProfile) refreshProfile(); 
        setTimeout(() => setRetryCount(prev => prev + 1), 1000 + retryCount * 500); // Exponential backoff for retries
      } else {
        setStatusMessage('Failed to load your profile after multiple retries. Please contact support.');
        console.error('[AuthCallback] Failed to load userProfile after max retries. User ID:', user.id);
        // Potentially navigate to an error page or login
        navigate('/login?error=profile_load_failed', { replace: true });
      }
      return;
    }

    // User and UserProfile are available. Start processing logic.
    processingRef.current = true; // Mark as processing
    setStatusMessage('Your profile loaded. Determining next step...');
    console.log('[AuthCallback] User and UserProfile loaded. Processing intent...');

    const intentDataString = localStorage.getItem('oauth_intent_data');
    let intentData: OAuthIntentData | null = null;
    if (intentDataString) {
      try {
        intentData = JSON.parse(intentDataString);
        console.log('[AuthCallback] Parsed oauth_intent_data from localStorage:', intentData);
      } catch (e) {
        console.error('[AuthCallback] Error parsing oauth_intent_data from localStorage:', e);
        setStatusMessage('Error processing OAuth intent. Please try again.');
        // Decide on a fallback, e.g., navigate to dashboard or login
        navigate(userProfile.role === 'developer' ? '/developer' : '/dashboard', { replace: true });
        localStorage.removeItem('oauth_intent_data'); // Clean up invalid data
        return;
      }
    }

    // Clear the intent data from localStorage once read, regardless of outcome next.
    localStorage.removeItem('oauth_intent_data');
    console.log('[AuthCallback] Removed oauth_intent_data from localStorage.');

    const requiresGitHubAppInstall = intentData?.install_after_auth === true && userProfile.role === 'developer';
    console.log(`[AuthCallback] Decision variables: requiresGitHubAppInstall=${requiresGitHubAppInstall}, developerProfile exists=${!!developerProfile}, ghInstId=${developerProfile?.github_installation_id}`);

    if (requiresGitHubAppInstall) {
      // Developer role, and intent was to install the app.
      // Check if developerProfile is loaded and if github_installation_id is already set.
      // It's possible developerProfile is not yet loaded if ensureDeveloperProfile in AuthContext is still running
      // or if it's a brand new developer profile being created.
      if (!developerProfile || !developerProfile.github_installation_id) {
        // If developerProfile is missing or doesn't have an installation ID, proceed to install.
        // This is the critical path for new developers.
        // We add a small delay IF developerProfile itself is missing, to give AuthContext one last chance to load it
        // in case it was just created and includes an ID from a previous installation by the same GitHub user.
        if (!developerProfile && retryCount < maxRetries) {
            setStatusMessage(`Developer profile not yet fully available for GitHub App check (Attempt ${retryCount + 1}/${maxRetries}). Verifying existing installations...`);
            console.log(`[AuthCallback] Developer user, requires app install, but developerProfile not yet available. Retrying for developerProfile... (Attempt ${retryCount + 1})`);
            if (refreshProfile) refreshProfile();
            setTimeout(() => {
                setRetryCount(prev => prev + 1);
                processingRef.current = false; // Allow retry
            }, 1000 + retryCount * 500);
            return;
        }
        // If developerProfile exists but no ghInstId, or if retries exhausted for loading developerProfile:
        console.log('[AuthCallback] Conditions met: Developer, install intent, and no GitHub App ID found in developerProfile. Redirecting to GitHub App Install.');
        redirectToGitHubAppInstall();
        return; // Important: stop further execution
      } else {
        // Developer profile exists AND has an installation ID. App is already connected.
        console.log('[AuthCallback] Developer, install intent, but GitHub App already connected (ghInstId found). Navigating to developer dashboard.');
        navigate('/developer', { replace: true, state: { fromAuthCallback: true, ghAppConnected: true } });
      }
    } else {
      // Not a developer requiring app install, or no install intent.
      // Navigate to the appropriate dashboard based on role.
      const destination = userProfile.role === 'developer' ? '/developer' : '/dashboard';
      console.log(`[AuthCallback] No GitHub App installation required or different role. Navigating to ${destination}.`);
      navigate(destination, { replace: true, state: { fromAuthCallback: true } });
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile, developerProfile, authContextLoading, authError, navigate, redirectToGitHubAppInstall, retryCount, refreshProfile]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
      color: '#333',
      textAlign: 'center'
    }}>
      <Loader className="animate-spin h-12 w-12 text-blue-600 mb-6" />
      <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Processing Authentication</h1>
      <p style={{ fontSize: '16px', color: '#555' }}>{statusMessage}</p>
      {authError && <p style={{ fontSize: '14px', color: 'red', marginTop: '10px' }}>Error: {authError}</p>}
      {retryCount > 2 && <p style={{fontSize: '12px', color: '#777', marginTop: '20px'}}>Attempt {retryCount} of {maxRetries}. If this persists, please try logging in again or contact support.</p>}
    </div>
  );
};
