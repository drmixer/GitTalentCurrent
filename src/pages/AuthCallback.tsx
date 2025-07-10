import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 

interface OAuthIntentData {
  install_after_auth?: boolean;
  [key: string]: any;
}

const GITHUB_APP_SLUG = 'GitTalentApp'; // Keep for redirectToGitHubAppInstall if needed manually

export const AuthCallback: React.FC = () => {
  console.log('[AuthCallback] DEBUG RENDER: Component function body executing. Href:', window.location.href);

  const { user, userProfile, developerProfile, loading: authLoading, authError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [debugMessage, setDebugMessage] = useState('AuthCallback: Initializing state...');
  const [localStorageData, setLocalStorageData] = useState<OAuthIntentData | null>(null);
  const [authContextState, setAuthContextState] = useState<any>({});

  useEffect(() => {
    console.log('[AuthCallback] DEBUG EFFECT: useEffect triggered. Location search:', location.search);
    setDebugMessage(`useEffect triggered at ${new Date().toISOString()}. User ID from context: ${user?.id}`);

    const intentDataString = localStorage.getItem('oauth_intent_data');
    let parsedIntent: OAuthIntentData | null = null;
    if (intentDataString) {
      try {
        parsedIntent = JSON.parse(intentDataString);
        setLocalStorageData(parsedIntent);
        console.log('[AuthCallback] DEBUG EFFECT: Retrieved from localStorage oauth_intent_data:', parsedIntent);
        // localStorage.removeItem('oauth_intent_data'); // Keep for now for debugging visibility
      } catch (e) {
        console.error('[AuthCallback] DEBUG EFFECT: Error parsing oauth_intent_data:', e);
        setLocalStorageData({ install_after_auth: false, error_parsing: true } as any);
      }
    } else {
      console.log('[AuthCallback] DEBUG EFFECT: No oauth_intent_data found in localStorage.');
      setLocalStorageData({ install_after_auth: undefined, not_found: true } as any);
    }
    
    setAuthContextState({
        timestamp: new Date().toISOString(),
        userExists: !!user,
        userId: user?.id,
        authLoading,
        userProfileExists: !!userProfile,
        userProfileRole: userProfile?.role,
        developerProfileExists: developerProfile !== undefined,
        developerProfileGhInstId: developerProfile?.github_installation_id,
        locationSearch: location.search,
        parsedStateDataFromUrlDirectly: new URLSearchParams(location.search).get('state'), // Check if state is in search
        localStorageIntent: parsedIntent
    });

    setDebugMessage('AuthCallback: useEffect processed. Check console & debug info. No auto-navigation.');

    if (user && parsedIntent?.install_after_auth && userProfile?.role === 'developer' && !developerProfile?.github_installation_id) {
        console.log("[AuthCallback] DEBUG EFFECT: ***DECISION: Conditions met to REDIRECT TO GITHUB APP INSTALL***");
        setDebugMessage(prev => prev + " | DECISION: WOULD REDIRECT TO GITHUB APP INSTALL.");
    } else if (user && userProfile) {
        console.log("[AuthCallback] DEBUG EFFECT: ***DECISION: Conditions met to REDIRECT TO DASHBOARD***");
        setDebugMessage(prev => prev + ` | DECISION: WOULD REDIRECT TO ${userProfile.role === 'developer' ? '/developer' : '/dashboard'}.`);
    } else if (!authLoading && !user) {
        console.log("[AuthCallback] DEBUG EFFECT: ***DECISION: Conditions met to REDIRECT TO LOGIN***");
        setDebugMessage(prev => prev + " | DECISION: WOULD REDIRECT TO LOGIN.");
    }

  }, [location.search, user, userProfile, developerProfile, authLoading]);

  const handleRedirectToAppInstall = () => {
    if (!user?.id) {
      console.warn('[AuthCallback DEBUG] Manually trying redirectToGitHubAppInstall: No user ID.');
      alert('Cannot redirect: No user ID.');
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
    console.log('[AuthCallback] DEBUG: Manually triggering redirect to GitHub App Install URL:', githubAppInstallUrl);
    alert(`DEBUG: Would redirect to: ${githubAppInstallUrl}`);
    // window.location.href = githubAppInstallUrl; 
  };

  return (
    <div style={{ border: '5px solid limegreen', padding: '20px', margin: '20px', backgroundColor: '#f0fff0', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      <h1>AuthCallback - EXTREME DEBUG VIEW</h1>
      <p><strong>This page should remain visible. No automatic redirects are active.</strong></p>
      <p><strong>Current Time:</strong> {new Date().toLocaleTimeString()}</p>
      <p><strong>Window Location Href:</strong> {window.location.href}</p>
      <p style={{color: 'blue', fontWeight: 'bold'}}>useEffect Message: {debugMessage}</p>
      <hr />
      <h3>localStorage ('oauth_intent_data') (at useEffect run):</h3>
      <pre>{JSON.stringify(localStorageData, null, 2) || "Not yet checked or not found"}</pre>
      <hr />
      <h3>AuthContext State & More (at last useEffect run):</h3>
      <pre>{JSON.stringify(authContextState, null, 2)}</pre>
      <hr />
      <button onClick={() => { console.log('[AuthCallback DEBUG] Manually calling refreshProfile()'); if(refreshProfile) refreshProfile(); }} style={{padding: '10px', margin: '5px', border: '1px solid black'}}>Refresh AuthContext Profile</button>
      <button onClick={() => { localStorage.removeItem('oauth_intent_data'); console.log('[AuthCallback DEBUG] Cleared oauth_intent_data.'); alert('oauth_intent_data cleared'); setLocalStorageData(null);}} style={{padding: '10px', margin: '5px', border: '1px solid black'}}>Clear oauth_intent_data</button>
      <button onClick={handleRedirectToAppInstall} style={{padding: '10px', margin: '5px', border: '1px solid orange'}}>Manually Trigger App Install Redirect Logic</button>
      <button onClick={() => navigate('/developer')} style={{padding: '10px', margin: '5px', border: '1px solid green'}}>Manually Go to /developer</button>
    </div>
  );
};
