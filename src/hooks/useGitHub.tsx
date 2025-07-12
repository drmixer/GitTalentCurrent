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

export const useGitHub = (developerProfile?: Developer) => {
  const context = useContext(GitHubContext);
  if (context === undefined && !developerProfile) {
    throw new Error('useGitHub must be used within a GitHubProvider or be provided with a developer profile.');
  }
  return context;
};

export const GitHubProvider = ({ children }: { children: ReactNode }) => {
  const { user, developerProfile, updateDeveloperProfile, loading: authLoading, lastProfileUpdateTime } = useAuth(); // Added lastProfileUpdateTime

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
    if (!handle) {
      // console.log('refreshGitHubDataInternal - No GitHub handle provided'); // Kept for clarity if needed
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

    try {
      setFetchInProgress(true);
      setLoading(true);
      setError(null);

      const installationId = developerProfile?.github_installation_id;

      if (!installationId && hasExistingData) {
        // console.log('No GitHub installation ID but we have data - user needs to install the GitHub App'); // Kept
        setError(new Error('GitHub App not connected. Please connect the GitHub App to see your real-time contributions.'));
        setLoading(false);
        setFetchInProgress(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/github-proxy`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          handle,
          installationId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
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
      console.error('Error in refreshGitHubDataInternal:', err.message || err); // Keep console.error
      setError(err);
    } finally {
      setLoading(false);
      setFetchInProgress(false);
    } 
  }, [developerProfile, user, gitHubData.user, lastFetchedHandle]);

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

    // Main debug log for useEffect, can be removed or kept commented
    //   'useGitHub DEBUG useEffect: Evaluating. AuthLoading:', authLoading,
    //   'DevProfile Handle:', developerProfile?.github_handle,
    //   'DevProfile InstallID:', developerProfile?.github_installation_id,
    //   'DevProfile Exists:', !!developerProfile,
    //   'LastProfileUpdateTime:', lastProfileUpdateTime
    // );

    if (authLoading) {
      setLoading(true); // Keep loading true while auth is resolving
      return;
    }

    if (!developerProfile || !developerProfile.github_handle) {
      console.warn('[useGitHub useEffect] Developer profile or GitHub handle not available.');
      setGitHubData({ user: null, repos: [], languages: {}, totalStars: 0, contributions: [] });
      setError(new Error('Developer profile or GitHub handle not available for GitHub activity.'));
      setLoading(false); // Stop loading if no profile/handle to act on
      return;
    }

    // At this point, auth is done, developerProfile and github_handle exist.
    // const currentDevProfile = developerProfile; // REVERTED: This was a mistaken re-declaration.
                                                // The existing currentDevProfile from the top of useEffect should be used.
    const ghHandle = currentDevProfile.github_handle; // Uses existing currentDevProfile
    const ghInstId = currentDevProfile.github_installation_id; // Uses existing currentDevProfile

    const now = Date.now();

    if (ghInstId && String(ghInstId).trim() !== '' && ghInstId !== 'none' && ghInstId !== 'not available') {
      // Valid ID found
      if (loading || error) { // Only clear error/loading if they were previously set
        setError(null);
        setLoading(false); // Ensure loading is false now that we are proceeding
      }
      console.log(`[useGitHub useEffect] Valid ghInstId ('${ghInstId}') found for ${ghHandle} (profileTime: ${lastProfileUpdateTime}). Calling refreshGitHubData.`);
      refreshGitHubData(ghHandle);
    } else {
      // ghInstId is missing or invalid
      const profileJustUpdated = lastProfileUpdateTime && (now - lastProfileUpdateTime < 3000); // 3s window

      if (profileJustUpdated && loading) {
        // We are already in a loading state, and profile was just updated.
        // This means we previously decided to wait. Continue waiting.
        console.warn(`[useGitHub useEffect] Still waiting for ghInstId ('${ghInstId}') for ${ghHandle}. Profile update was recent (${lastProfileUpdateTime}).`);
        // No explicit state change here, relies on effect re-running if deps change further or timeout via not profileJustUpdated
      } else if (profileJustUpdated && !loading && !error) {
        // Profile just updated, we weren't previously loading (for this reason) and no error yet.
        // This is the first time we're seeing a recent update with a missing ID. Decide to wait.
        console.warn(`[useGitHub useEffect] Missing ghInstId ('${ghInstId}') for ${ghHandle}. Profile update was recent (${lastProfileUpdateTime}). Starting to wait briefly.`);
        setLoading(true); // Start loading to indicate we are waiting.
        setError(null); // Ensure no previous unrelated error sticks.
      } else {
        // Condition to set error:
        // 1. Profile update wasn't recent (timed out waiting).
        // OR 2. We are not in a loading state attributed to waiting (e.g. initial load, or error was already set).
        // OR 3. An error is already set (don't override it with more waiting).
        console.warn(`[useGitHub useEffect] Missing or invalid ghInstId ('${ghInstId}') for ${ghHandle}. Setting error. Profile updated at: ${lastProfileUpdateTime}, profileJustUpdated: ${profileJustUpdated}, loading: ${loading}, error: ${!!error}`);
        setGitHubData({ user: null, repos: [], languages: {}, totalStars: 0, contributions: [] });
        setError(new Error(`GitHub App connection is incomplete or Installation ID ('${ghInstId}') is invalid. Please try reconnecting the GitTalent GitHub App from your profile settings if this persists.`));
        setLoading(false);
      }
    }
  }, [developerProfile, authLoading, refreshGitHubData, lastProfileUpdateTime, loading, error]); // Added loading and error to deps

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