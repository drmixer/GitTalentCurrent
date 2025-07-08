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
  const [lastFetchedInstallationId, setLastFetchedInstallationId] = useState<string | null | undefined>(null); // Re-add for more precise checks

  const refreshGitHubDataInternal = useCallback(async (handle: string, installationIdParam?: string) => { // installationIdParam is the one to use
    if (!handle) {
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      setFetchInProgress(false);
      return;
    }

    // If already fetching for the exact same handle and installationId context, skip.
    if (fetchInProgress && lastFetchedHandle === handle && lastFetchedInstallationId === installationIdParam) {
      // console.log(`[useGitHub] Fetch already in progress for ${handle} with ID ${installationIdParam}.`);
      return;
    }

    // Postponing logic: if this call is for the authenticated user (handle matches developerProfile.github_handle)
    // AND the installationIdParam intended for this call is missing (falsy), then postpone.
    // This typically happens on initial load after app install, waiting for AuthContext to update.
    if (handle === developerProfile?.github_handle && !installationIdParam) {
      console.log(`[useGitHub] Postponing fetch for own data (${handle}): installationIdParam is '${installationIdParam}'. Waiting for context. DeveloperProfile ID: ${developerProfile?.github_installation_id}`);
      // Note: setLoading(true) might have been set by the caller or previous effect.
      // We don't change fetchInProgress here, letting the useEffect re-trigger.
      return;
    }

    const hasExistingData =
      lastFetchedHandle === handle &&
      lastFetchedInstallationId === installationIdParam && // Data is specific to this install ID context
      gitHubData.user &&
      gitHubData.user.login?.toLowerCase() === handle.toLowerCase() &&
      gitHubData.contributions.length > 0;

    if (hasExistingData) {
      // console.log(`[useGitHub] Has existing data for ${handle} with ID ${installationIdParam}.`);
      // Ensure loading is false if we skip the fetch for existing data.
      setLoading(false);
      setFetchInProgress(false); // also reset this if we are not fetching.
      return;
    }

    // --- Start actual fetch process ---
    setFetchInProgress(true);
    setLoading(true);
    setError(null); // Reset error at the start of every new fetch attempt

    try {
      // The `installationIdParam` is now the single source of truth for the installation ID for this fetch.
      // If `installationIdParam` is undefined/null/empty, the proxy will receive that.
      // The proxy must then decide if it can fetch public data or if an ID is strictly required.

      // Removed the `if (!installationIdParam && hasExistingData)` block that set an error here.
      // Let the actual fetch result (or proxy error) dictate the error state.

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
          installationId: installationIdParam // Use the passed parameter
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
      setLastFetchedInstallationId(installationIdParam); // Store the installationId used for this fetch

      if (handle === developerProfile?.github_handle && developerProfile?.user_id === user?.id) {
        await syncLanguagesToProfile();
        await syncProjectsToProfile();
      } 

    } catch (err: any) {
      console.error('Error in refreshGitHubDataInternal:', err.message || err);
      setError(err);
    } finally {
      setLoading(false);
      setFetchInProgress(false);
    } 
  }, [developerProfile, user, gitHubData.user, lastFetchedHandle, lastFetchedInstallationId, fetchInProgress, syncLanguagesToProfile, syncProjectsToProfile]);


  const refreshGitHubData = useCallback(async (targetHandle?: string, targetInstallationId?: string) => {
    const handleToUse = targetHandle || developerProfile?.github_handle;
    if (!handleToUse) {
      setLoading(false); // Also set loading false here
      setError(new Error('No GitHub handle provided'));
      return;
    }

    let installationIdToUseForCall: string | undefined | null = targetInstallationId;

    // If targetInstallationId is not provided (undefined),
    // and we are fetching for the authenticated user (handleToUse matches their handle),
    // then use the installationId from their developerProfile context.
    if (targetInstallationId === undefined && handleToUse === developerProfile?.github_handle) {
      installationIdToUseForCall = developerProfile?.github_installation_id;
    }
    // If targetInstallationId IS provided, it will be used.
    // If targetHandle is for someone else AND targetInstallationId is undefined, installationIdToUseForCall remains undefined.

    await refreshGitHubDataInternal(handleToUse, installationIdToUseForCall);
  }, [developerProfile, refreshGitHubDataInternal]); // refreshGitHubDataInternal is stable if its deps are

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
        // console.log(`useGitHub DEBUG useEffect: Conditions MET. Handle: '${ghHandle}', InstallID: '${ghInstId}'. Scheduling refreshGitHubData.`); // Can be removed
        const timer = setTimeout(() => {
          // console.log('useGitHub DEBUG useEffect: Timer fired. Calling refreshGitHubData.'); // Can be removed
          refreshGitHubData(ghHandle);
        }, 500);
        return () => {
          // console.log('useGitHub DEBUG useEffect: Cleanup timer for refresh call.'); // Can be removed
          clearTimeout(timer);
        };
      } else {
        console.warn(`useGitHub: Handle '${ghHandle}' present, but Installation ID is invalid/missing: '${ghInstId}'. Not fetching GitHub data.`); // Keep warn
        setError(new Error(`GitHub App connection is incomplete or ID not yet synced. Installation ID found: '${ghInstId}'. Please ensure the GitHub App is correctly installed and connected. Data may update shortly.`));
        setLoading(false);
        setGitHubData({ user: null, repos: [], languages: {}, totalStars: 0, contributions: [] });
      }
    } else {
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