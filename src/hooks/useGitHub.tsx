import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { calculateContributionStats } from '../utils/githubUtils';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
  created_at: string;
  fork: boolean;
  private: boolean;
}

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  location: string | null;
  blog: string | null;
  company: string | null;
  avatar_url: string;
  created_at: string;
}

interface GitHubLanguages {
  [key: string]: number;
}

interface GitHubContribution {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface GitHubData {
  user: GitHubUser | null;
  repos: GitHubRepo[];
  languages: GitHubLanguages;
  totalStars: number;
  contributions: GitHubContribution[];
  currentStreak?: number;
  longestStreak?: number;
  averageContributions?: number;
}

interface GitHubContextType {
  gitHubData: GitHubData;
  loading: boolean;
  error: Error | null;
  refreshGitHubData: (handle?: string) => Promise<void>;
  getTopLanguages: (limit?: number) => string[];
  getTopRepos: (limit?: number) => GitHubRepo[];
  syncLanguagesToProfile: () => Promise<void>;
  syncProjectsToProfile: () => Promise<void>;
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined);

export const useGitHub = () => {
  const context = useContext(GitHubContext);
  if (context === undefined) {
    throw new Error('useGitHub must be used within a GitHubProvider');
  }
  return context;
};

export const GitHubProvider = ({ children }: { children: ReactNode }) => {
  const { user, developerProfile, updateDeveloperProfile, loading: authLoading } = useAuth();

  const [gitHubData, setGitHubData] = useState<GitHubData>({
    user: null,
    repos: [],
    languages: {},
    totalStars: 0,
    contributions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [lastFetchedHandle, setLastFetchedHandle] = useState<string | null>(null);

  const refreshGitHubDataInternal = useCallback(async (handle: string) => {
    const installationIdFromContext = developerProfile?.github_installation_id; // Get this early for logging
    console.log('[RDI] Entry. Handle:', handle, 'Context InstallationID:', installationIdFromContext);

    if (!handle) {
      console.log('[RDI] No handle provided, exiting.');
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      setFetchInProgress(false);
      return;
    }

    if (fetchInProgress) {
      // console.log('refreshGitHubDataInternal - Fetch already in progress for:', handle); // Kept for clarity
      return;
    }

    const hasExistingData = lastFetchedHandle === handle &&
                          gitHubData.user &&
                          gitHubData.user.login?.toLowerCase() === handle.toLowerCase() && gitHubData.contributions.length > 0;

    if (hasExistingData && developerProfile?.github_installation_id) {
      // console.log('refreshGitHubDataInternal - Already have data for handle:', handle, 'with installation ID'); // Kept
      setTimeout(() => setLoading(false), 200);
      return;
    }

    // NB: The 'installationId' used below is the one derived from developerProfile at the start of this function call.
    // If the 'postponing' logic in the main useEffect is working, this should eventually be the correct ID for new users.
    console.log('[RDI] Proceeding to fetch. Using installationId from context:', installationIdFromContext);

    try {
      setFetchInProgress(true);
      setLoading(true);
      setError(null);

      // const installationId = developerProfile?.github_installation_id; // Already got as installationIdFromContext

      if (!installationIdFromContext && hasExistingData) {
        console.log('[RDI] No installationId from context, but hasExistingData. Setting error.');
        setError(new Error('GitHub App not connected. Please connect the GitHub App to see your real-time contributions.'));
        // setLoading(false); // This will be handled by finally
        // setFetchInProgress(false); // This will be handled by finally
        // throw new Error('GitHub App not connected but has existing data.'); // Or throw to go to catch & finally
        // For now, let it try to fetch if !hasExistingData, proxy will error if ID is mandatory
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/github-proxy`;
      
      console.log('[RDI] Making fetch call to proxy with handle:', handle, 'and installationId:', installationIdFromContext);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          handle,
          installationId: installationIdFromContext
        })
      });

      console.log('[RDI] Fetch response received. ok:', response.ok, 'status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[RDI] Fetch not ok. Error text attempt:', errorText);
        let errorMessage = `GitHub API error: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[RDI] Data processed and setGitHubData called.');
      const contributionStats = calculateContributionStats(data.contributions || []);

      setGitHubData({
        user: data.user || null,
        repos: data.repos || [],
        languages: data.languages || {},
        totalStars: data.totalStars || 0,
        contributions: data.contributions || [],
        currentStreak: contributionStats.currentStreak,
        longestStreak: contributionStats.longestStreak,
        averageContributions: contributionStats.averagePerDay
      });
      setLastFetchedHandle(handle);

      if (handle === developerProfile?.github_handle && developerProfile?.user_id === user?.id) {
        await syncLanguagesToProfile();
        await syncProjectsToProfile();
      } 

    } catch (err: any) {
      console.error('[RDI] Caught error:', err);
      setError(err);
    } finally {
      console.log('[RDI] Entering finally block. setLoading(false), setFetchInProgress(false).');
      setLoading(false);
      setFetchInProgress(false);
    } 
  }, [developerProfile, user, gitHubData.user, lastFetchedHandle, syncLanguagesToProfile, syncProjectsToProfile]); // Added sync functions to deps as they are called

  const refreshGitHubData = useCallback(async (handle?: string) => {
    const handleToUse = handle || developerProfile?.github_handle;
    if (!handleToUse) {
      // console.log('refreshGitHubData - No GitHub handle provided or found in profile.'); // Kept
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      return;
    }

    if (fetchInProgress && lastFetchedHandle === handleToUse) {
      // console.log('refreshGitHubData - Fetch already in progress for handle:', handleToUse, 'Skipping duplicate request.'); // Kept
      return;
    }

    await refreshGitHubDataInternal(handleToUse);
  }, [developerProfile?.github_handle, fetchInProgress, lastFetchedHandle, refreshGitHubDataInternal]);

  useEffect(() => {
    const currentDevProfile = developerProfile;
    const currentAuthLoading = authLoading;

    // console.log( // Main debug log for useEffect, can be removed or kept commented
    //   'useGitHub DEBUG useEffect: Evaluating. AuthLoading:', currentAuthLoading,
    //   'DevProfile Handle:', currentDevProfile?.github_handle,
    //   'DevProfile InstallID:', currentDevProfile?.github_installation_id,
    //   'DevProfile Exists:', !!currentDevProfile
    // );

    if (currentAuthLoading) {
      // console.log('useGitHub DEBUG useEffect: Auth is loading. Waiting...'); // Can be removed
      return;
    }

    if (!currentDevProfile) {
      console.warn('useGitHub: Developer profile is NOT loaded (and auth is not loading). Cannot fetch GitHub data.'); // Keep warn
      setGitHubData({ user: null, repos: [], languages: {}, totalStars: 0, contributions: [] });
      setLoading(false);
      setError(new Error('Developer profile not available. Cannot fetch GitHub data.'));
      return;
    }

    const ghHandle = currentDevProfile.github_handle;
    const ghInstId = currentDevProfile.github_installation_id;

    if (ghHandle && String(ghHandle).trim() !== '') {
      if (ghInstId && String(ghInstId).trim() !== '' && ghInstId !== 'none' && ghInstId !== 'not available') {
        // Has handle and valid-looking installation ID. Proceed to fetch.
        setError(null); // Explicitly clear any previous error
        const timer = setTimeout(() => {
          refreshGitHubData(ghHandle);
        }, 250); // Slightly reduced timeout
        return () => clearTimeout(timer);
      } else {
        // Has a handle, but no valid installation ID *yet* in this render's developerProfile.
        // This could be a new user post-install where context hasn't updated,
        // OR a user who genuinely needs to connect.
        // Keep loading to give AuthContext a chance to provide the updated developerProfile.
        console.warn(`[useGitHub] Handle '${ghHandle}' present, but Installation ID ('${ghInstId}') is currently missing or invalid in context. Waiting for potential context update or longer timeout.`);
        setLoading(true); // Explicitly keep/set loading true
        setError(null);   // Clear any previous errors, as we are in a "waiting for context/timeout" state

        // Safety timeout to eventually attempt fetch if context never provides the ID quickly enough
        // or if this is a genuinely disconnected user.
        const waitingTimeout = setTimeout(() => {
          // Check loading flag, in case a concurrent successful refresh already happened.
          // Also check if developerProfile itself became null (e.g. user signed out during this wait)
          if (loading && developerProfile && developerProfile.github_handle === ghHandle) {
            console.warn(`[useGitHub] Waited, but Installation ID for ${ghHandle} still not in context or invalid ('${developerProfile.github_installation_id}'). Attempting fetch anyway.`);
            refreshGitHubData(ghHandle); // Attempt fetch, refreshGitHubDataInternal will use current (possibly null) ghInstId from context
          }
        }, 1500); // Wait 1.5 seconds
        return () => clearTimeout(waitingTimeout);
      }
    } else {
      // No GitHub handle.
      console.warn('useGitHub: No valid GitHub handle found in developer profile.');
      setGitHubData({ user: null, repos: [], languages: {}, totalStars: 0, contributions: [] });
      setLoading(false);
      setError(new Error('Your GitHub handle is missing from your profile. Please update it in your settings to see GitHub activity.'));
    }
  }, [developerProfile, authLoading, refreshGitHubData, loading]); // Added loading to dep array for safety timeout logic

  const getTopLanguages = useCallback((limit: number = 10): string[] => {
    return Object.entries(gitHubData.languages)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, limit) 
      .map(([language]) => language);
  }, [gitHubData.languages]);

  const getTopRepos = useCallback((limit: number = 10): GitHubRepo[] => {
    return gitHubData.repos
      .filter(repo => !repo.name.includes('.github.io') && !repo.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, limit); 
  }, [gitHubData.repos]);

  const syncLanguagesToProfile = useCallback(async () => {
    if (!developerProfile || loading || !user || developerProfile.github_handle !== lastFetchedHandle) {
      return;
    }

    const topLanguages = getTopLanguages(15); 
    if (topLanguages.length > 0) {
      const existingLanguages = developerProfile.top_languages || [];
      const mergedLanguages = [...new Set([...existingLanguages, ...topLanguages])];

      await updateDeveloperProfile?.({
        top_languages: mergedLanguages
      });
    }
  }, [developerProfile, loading, user, lastFetchedHandle, getTopLanguages, updateDeveloperProfile]);

  const syncProjectsToProfile = useCallback(async () => {
    if (!developerProfile || loading || !user || developerProfile.github_handle !== lastFetchedHandle) {
      return;
    }
    
    const topRepos = getTopRepos(8).map(repo => repo.html_url);
    if (topRepos.length > 0) {
      const existingProjects = developerProfile.linked_projects || [];
      const uniqueProjects = [...new Set([...existingProjects, ...topRepos])];

      await updateDeveloperProfile?.({
        linked_projects: uniqueProjects
      });
    }
  }, [developerProfile, loading, user, lastFetchedHandle, getTopRepos, updateDeveloperProfile]);

  const value = {
    gitHubData,
    loading,
    error,
    refreshGitHubData,
    getTopLanguages,
    getTopRepos,
    syncLanguagesToProfile,
    syncProjectsToProfile
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};