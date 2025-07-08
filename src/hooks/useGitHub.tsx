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
    if (!handle) {
      // console.log('refreshGitHubDataInternal - No GitHub handle provided'); // Kept for clarity if needed
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      setFetchInProgress(false);
      return;
    }

    // More specific check for fetchInProgress for the current handle
    if (fetchInProgress && lastFetchedHandle === handle) {
      // console.log('[useGitHub] Fetch already in progress for this specific handle:', handle);
      return;
    }

    const installationId = developerProfile?.github_installation_id;

    // If fetching for the currently authenticated user AND their installationId is not yet in context,
    // return early and wait for AuthContext to update and trigger a re-run.
    if (handle === developerProfile?.github_handle && !installationId) {
      console.log(`[useGitHub] Postponing fetch for own data (${handle}): github_installation_id not yet in developerProfile context. Current context value:`, installationId);
      // Do not set fetchInProgress or change loading state here; let the calling effect manage it or re-trigger.
      return;
    }

    const hasExistingData = lastFetchedHandle === handle &&
                          gitHubData.user &&
                          gitHubData.user.login?.toLowerCase() === handle.toLowerCase() &&
                          gitHubData.contributions.length > 0;

    // If we have existing data for this handle and a valid installationId context, consider it fresh enough for a short while.
    if (hasExistingData && installationId) {
      // console.log('[useGitHub] Has existing data and installation ID for handle:', handle);
      setTimeout(() => { if (lastFetchedHandle === handle) setLoading(false); }, 200); // check lastFetchedHandle again in timeout
      return;
    }

    // Only set loading/inProgress when an actual fetch is about to happen
    setFetchInProgress(true);
    setLoading(true);
    setError(null);

    try {
      // Note: installationId used here is from the top of this function scope, reflecting developerProfile at call time.
      // This is correct because if it was missing for current user, we returned early.
      // If it's for another user, this is the best we have (null if not their own profile usually).

      // The check `if (!installationId && hasExistingData)` was here.
      // If installationId is required by proxy and missing, the fetch will fail and error will be set.
      // If it's not required, fetch might return public data.
      // Removing the explicit error set here to rely on actual fetch outcome.

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
  }, [developerProfile, user, gitHubData.user, lastFetchedHandle, fetchInProgress, syncLanguagesToProfile, syncProjectsToProfile]); // Added fetchInProgress and sync functions

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
    // const ghInstId = currentDevProfile.github_installation_id; // No longer used to gate call here

    if (ghHandle && String(ghHandle).trim() !== '') {
      // Always attempt to refresh if handle exists.
      // refreshGitHubData will internally use developerProfile.github_installation_id from context.
      const timer = setTimeout(() => {
        refreshGitHubData(ghHandle);
      }, 500);
      return () => {
        clearTimeout(timer);
      };
    } else {
      // If no handle, then it's appropriate to set an error or clear data.
      console.warn('useGitHub: No valid GitHub handle found in developer profile.'); // Keep warn
      setGitHubData({ user: null, repos: [], languages: {}, totalStars: 0, contributions: [] });
      setLoading(false);
      setError(new Error('Your GitHub handle is missing from your profile. Please update it in your settings to see GitHub activity.'));
    }
  }, [developerProfile, authLoading, refreshGitHubData]);

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