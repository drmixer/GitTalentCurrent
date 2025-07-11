import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, RefreshCw } from 'lucide-react';

// GitHub App slug - must match exactly what's configured in GitHub
const GITHUB_APP_SLUG = 'GitTalentApp'; 
// Maximum number of retries for auth loading
const maxRetries = 5;

// Interface for state data from URL parameters
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
  const navigate = useNavigate();
  const location = useLocation();

  const [message, setMessage] = useState('AuthCallback: Initializing...');

  useEffect(() => {
    console.log('[AuthCallback] useEffect triggered. Location search:', location.search);
    setMessage(`AuthCallback: useEffect triggered. User: ${user ? user.id : 'null'}, AuthLoading: ${authLoading}, UserProfile: ${userProfile ? userProfile.id : 'null'}`);

    const params = new URLSearchParams(location.search);
    const state = params.get('state');
    let stateData: StateData = {};
    if (state) {
      try {
        stateData = JSON.parse(decodeURIComponent(state));
        if (typeof stateData.install_after_auth === 'string') {
          stateData.install_after_auth = stateData.install_after_auth.toLowerCase() === 'true';
        }
         console.log('[AuthCallback] Parsed stateData in useEffect:', stateData);
      } catch (e) { console.error('State parse error', e); }
    } else {
        console.log('[AuthCallback] No state param in useEffect.');
    }

    // DO NOT NAVIGATE AUTOMATICALLY FOR NOW - let's see the logs
    // All automatic navigation logic is commented out for this test.
    // We want to see if this component renders and logs its state.

    // Example of what we want to check:
    if (user && stateData.install_after_auth) {
        console.log(`[AuthCallback] DEBUG: User exists and install_after_auth is true. UserProfile role: ${userProfile?.role}, DevProfile ghId: ${developerProfile?.github_installation_id}`);
        if (userProfile?.role === 'developer' && !developerProfile?.github_installation_id) {
            console.log("[AuthCallback] DEBUG: Conditions met to redirect to GitHub App Install.");
            // redirectToGitHubAppInstall(); // Navigation commented out
            setMessage("DEBUG: Conditions met to redirect to GitHub App Install. Navigation commented out.");
        } else {
            console.log("[AuthCallback] DEBUG: Conditions for app install NOT met, or already installed. Would normally navigate to dashboard.");
            // navigate(userProfile?.role === 'developer' ? '/developer' : '/dashboard', { replace: true }); // Navigation commented out
            setMessage(`DEBUG: Would navigate to ${userProfile?.role === 'developer' ? '/developer' : '/dashboard'}. Navigation commented out.`);
        }
    } else if (user) {
        console.log("[AuthCallback] DEBUG: User exists but no install_after_auth flag, or flag is false. Would navigate to dashboard.");
        // navigate(userProfile?.role === 'developer' ? '/developer' : '/dashboard', { replace: true }); // Navigation commented out
        setMessage(`DEBUG: User exists, no install_after_auth. Would navigate to ${userProfile?.role === 'developer' ? '/developer' : '/dashboard'}. Navigation commented out.`);
    } else if (!authLoading && !user) {
        console.log("[AuthCallback] DEBUG: No user, not authLoading. Would navigate to login.");
        // navigate('/login', {replace: true}); // Navigation commented out
        setMessage("DEBUG: No user, not authLoading. Would navigate to login. Navigation commented out.");
    }


    return () => {
      console.log('[AuthCallback] useEffect cleanup.');
    };
  }, [user, userProfile, developerProfile, authLoading, location.search]); // Simplified dependency array for this test

  const redirectToGitHubAppInstall = useCallback(() => {
    // ... (this function can remain as is)
    if (!user?.id) {
      console.warn('redirectToGitHubAppInstall: No user ID available.');
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
    // window.location.href = githubAppInstallUrl; // Actual redirect commented out for test
  }, [user]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      <h1>AuthCallback Page - Debug View</h1>
      <p><strong>Current Message:</strong> {message}</p>
      <p><strong>Location Search:</strong> {location.search}</p>
      <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
      <p><strong>User Profile ID:</strong> {userProfile?.id || 'N/A'} (Role: {userProfile?.role || 'N/A'})</p>
      <p><strong>Developer Profile User ID:</strong> {developerProfile?.user_id || 'N/A'} (GH Install ID: {developerProfile?.github_installation_id || 'N/A'})</p>
      <p><strong>Auth Loading:</strong> {String(authLoading)}</p>
      <p><strong>Auth Error:</strong> {authError || 'N/A'}</p>
      <button onClick={() => refreshProfile && refreshProfile()} style={{padding: '10px', margin: '10px', border: '1px solid black'}}>Manually Refresh Profile (AuthContext)</button>
      <button onClick={redirectToGitHubAppInstall} style={{padding: '10px', margin: '10px', border: '1px solid black'}}>Manually Trigger redirectToGitHubAppInstall (Debug - No actual redirect)</button>
    </div>
  );
};