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

export const useGitHub = (initialHandle?: string) => {
  const { user, developerProfile, updateDeveloperProfile } = useAuth();
  const [gitHubData, setGitHubData] = useState<GitHubData>({
    user: null,
    repos: [],
    languages: {},
    totalStars: 0,
    contributions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetchedHandle, setLastFetchedHandle] = useState<string | null>(null);

  const refreshGitHubData = useCallback(async (handle?: string) => {
    const handleToUse = handle || initialHandle;
    if (!handleToUse) {
      //setError(new Error('No GitHub handle provided for refresh.'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The installation ID should correspond to the developer whose data is being fetched.
      // If we are fetching for the logged-in user, we can get it from their profile.
      // For other developers, this might need to be passed in or handled differently if they have connected the app.
      const installationId = (handleToUse === developerProfile?.github_handle)
        ? developerProfile.github_installation_id
        : undefined; // Or fetch it if a mechanism exists

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/github-proxy`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          handle: handleToUse,
          installationId // This may be null, and the backend should handle it
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `GitHub API error: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) { errorMessage = errorText; }
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
      setLastFetchedHandle(handleToUse);

      // Syncing should only happen for the logged-in user's own data
      if (handleToUse === developerProfile?.github_handle && developerProfile?.user_id === user?.id) {
        syncLanguagesToProfile();
        syncProjectsToProfile();
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [initialHandle, developerProfile, user, syncLanguagesToProfile, syncProjectsToProfile]);

  useEffect(() => {
    if (initialHandle) {
      refreshGitHubData(initialHandle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHandle]); // Intentionally re-running only when the initial handle changes.

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

  return {
    gitHubData,
    loading,
    error,
    refreshGitHubData,
    getTopLanguages,
    getTopRepos,
    syncLanguagesToProfile,
    syncProjectsToProfile
  };
};