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

    // If ghInstId is missing BUT lastProfileUpdateTime is very recent (e.g., within last 3 seconds),
    // it's possible it's about to arrive. So, remain in a loading state without setting a hard error.
    const now = Date.now();
    const profileUpdateIsRecent = lastProfileUpdateTime && (now - lastProfileUpdateTime < 3000); // 3 seconds threshold

    if (ghInstId && String(ghInstId).trim() !== '' && ghInstId !== 'none' && ghInstId !== 'not available') {
      console.log(`[useGitHub useEffect] Valid ghInstId ('${ghInstId}') found for ${ghHandle} (profileTime: ${lastProfileUpdateTime}). Calling refreshGitHubData.`);
      setError(null); // Clear any previous error state
      refreshGitHubData(ghHandle); // This will use the ghInstId from the current developerProfile
    } else {
      // ghInstId is missing or invalid
      if (profileUpdateIsRecent && !error) { // Added !error to prevent flicker if error was already set
        console.warn(`[useGitHub useEffect] Missing ghInstId ('${ghInstId}') for ${ghHandle} (profileTime: ${lastProfileUpdateTime}), but profile update was recent. Waiting briefly.`);
        setLoading(true); // Stay in loading state, don't set hard error yet
        // The effect will re-run when lastProfileUpdateTime changes again or if developerProfile instance changes.
      } else {
        console.warn(`[useGitHub useEffect] Missing or invalid ghInstId ('${ghInstId}') for ${ghHandle} (profileTime: ${lastProfileUpdateTime}). Setting error.`);
        setGitHubData({ user: null, repos: [], languages: {}, totalStars: 0, contributions: [] }); // Clear data
        setError(new Error(`GitHub App connection is incomplete or Installation ID ('${ghInstId}') is invalid. Please try reconnecting the GitTalent GitHub App from your profile settings if this persists.`));
        setLoading(false); // Stop loading, show error.
      }
    }
  }, [developerProfile, authLoading, refreshGitHubData, lastProfileUpdateTime, error]); // Added lastProfileUpdateTime and error

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