import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 
import { supabase } from '../lib/supabase'; // Assuming supabase client is exported from here
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

// GitHub App slug - must match exactly what's configured in GitHub
const GITHUB_APP_SLUG = 'GitTalentApp'; 

interface StateData {
  name?: string;
  role?: string;
  install_after_auth?: boolean | string;
  redirect_uri?: string;
  [key: string]: any;
}

export const AuthCallback: React.FC = () => {
  console.log('[AuthCallback] Component rendering. Top Level. Location Href:', window.location.href);

  const { user, userProfile, developerProfile, loading: authLoading, authError, refreshProfile } = useAuth();
  const navigate = useNavigate(); // We'll keep navigate for manual buttons if needed, but not use for auto-redirect
  const location = useLocation();

  const [message, setMessage] = useState('AuthCallback: Initializing and waiting for useEffect...');
  const [internalStateDebug, setInternalStateDebug] = useState<any>({});

  // Function to redirect to GitHub App installation (will be manually triggered for debug)
  const redirectToGitHubAppInstall = useCallback(() => {
    if (!user?.id) {
      console.warn('[AuthCallback DEBUG] redirectToGitHubAppInstall: No user ID available.');
      setMessage('DEBUG: Cannot redirect to app install - No user ID.');
      return;
    }
    const stateObj = {
      user_id: user.id,
      redirect_uri: `${window.location.origin}/github-setup`,
      from_auth: true,
      timestamp: Date.now(), 
    };
    const stateParam = encodeURIComponent(JSON.stringify(stateObj));
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}`;
    console.log('[AuthCallback] DEBUG: Preparing to redirect to GitHub App Install URL:', githubAppInstallUrl);
    setMessage(`DEBUG: Would redirect to: ${githubAppInstallUrl}`);
    // window.location.href = githubAppInstallUrl; // Actual redirect commented out for test
  }, [user]);

  useEffect(() => {
    console.log('[AuthCallback] useEffect triggered. Location search:', location.search);
    const currentParams = new URLSearchParams(location.search);
    const stateParamFromUrl = currentParams.get('state');
    let parsedStateData: StateData = {};

    if (stateParamFromUrl) {
      try {
        parsedStateData = JSON.parse(decodeURIComponent(stateParamFromUrl));
        if (typeof parsedStateData.install_after_auth === 'string') {
          parsedStateData.install_after_auth = parsedStateData.install_after_auth.toLowerCase() === 'true';
        }
         console.log('[AuthCallback] useEffect: Parsed stateData from URL:', parsedStateData);
      } catch (e) { 
        console.error('[AuthCallback] useEffect: State parse error', e);
      }
    } else {
        console.log('[AuthCallback] useEffect: No state param in URL.');
    }

    const debugInfo = {
        timestamp: new Date().toISOString(),
        userExists: !!user,
        userId: user?.id,
        authLoading,
        userProfileExists: !!userProfile,
        userProfileRole: userProfile?.role,
        developerProfileExists: developerProfile !== undefined,
        developerProfileGhInstId: developerProfile?.github_installation_id,
        locationSearch: location.search,
        parsedStateDataFromUrl: parsedStateData,
        installAfterAuthFlag: parsedStateData.install_after_auth
    };
    setInternalStateDebug(debugInfo);
    console.log('[AuthCallback] useEffect: Captured internal state for debug:', debugInfo);
    setMessage('AuthCallback: useEffect processed. Check console & debug info below. No automatic navigation will occur.');

    // All automatic navigation logic is removed for this test.
    // We want the component to render and display its state.

    return () => {
      console.log('[AuthCallback] useEffect cleanup.');
    };
  // IMPORTANT: Reduced dependency array to only run once on mount + when location.search changes, 
  // or when critical auth pieces settle. Add more if specific reactivity is needed for debug.
  }, [user, userProfile, developerProfile, authLoading, location.search]); 

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '2px solid red' }}>
      <h1>AuthCallback Page - DEBUG VIEW</h1>
      <p><strong>This page should remain visible. No automatic redirects are active.</strong></p>
      <hr />
      <p><strong>Current Message:</strong> {message}</p>
      <hr />
      <h2>Captured State from useEffect:</h2>
      <pre>{JSON.stringify(internalStateDebug, null, 2)}</pre>
      <hr />
      <h2>Current Context Values:</h2>
      <p><strong>User ID (from useAuth):</strong> {user?.id || 'N/A'}</p>
      <p><strong>User Email (from useAuth):</strong> {user?.email || 'N/A'}</p>
      <p><strong>Auth Loading (from useAuth):</strong> {String(authLoading)}</p>
      <p><strong>User Profile ID (from useAuth):</strong> {userProfile?.id || 'N/A'} (Role: {userProfile?.role || 'N/A'})</p>
      <p><strong>Developer Profile User ID (from useAuth):</strong> {developerProfile?.user_id || 'N/A'} (GH Install ID: {developerProfile?.github_installation_id ?? 'N/A'})</p>
      <p><strong>Auth Error (from useAuth):</strong> {authError || 'N/A'}</p>
      <hr />
      <button 
        onClick={() => {
          console.log('[AuthCallback DEBUG] Manually calling refreshProfile()'); 
          refreshProfile && refreshProfile();
        }}
        style={{padding: '10px', margin: '10px', border: '1px solid black', backgroundColor: 'lightgray'}}
      >
        Manually Trigger refreshProfile() (AuthContext)
      </button>
      <button 
        onClick={redirectToGitHubAppInstall} 
        style={{padding: '10px', margin: '10px', border: '1px solid black', backgroundColor: 'lightgray'}}
      >
        Manually Trigger redirectToGitHubAppInstall() (DEBUG - No actual redirect)
      </button>
      <button 
        onClick={() => navigate('/developer')} 
        style={{padding: '10px', margin: '10px', border: '1px solid green', backgroundColor: 'lightgreen'}}
      >
        Manually Navigate to /developer
      </button>
      <button 
        onClick={() => navigate('/github-setup')} 
        style={{padding: '10px', margin: '10px', border: '1px solid orange', backgroundColor: 'moccasin'}}
      >
        Manually Navigate to /github-setup
      </button>
    </div>
  );
};
