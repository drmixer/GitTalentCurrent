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
      console.log('refreshGitHubDataInternal - No GitHub handle provided');
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      setFetchInProgress(false);
      return;
    }

    if (fetchInProgress) {
      console.log('refreshGitHubDataInternal - Fetch already in progress for:', handle);
      return;
    }

    // Check if we already have data for this handle
    const hasExistingData = lastFetchedHandle === handle && 
                          gitHubData.user && 
                          gitHubData.user.login?.toLowerCase() === handle.toLowerCase() && gitHubData.contributions.length > 0;
    
    // Only prevent re-fetch if we have data and the installation ID is present
    if (hasExistingData && developerProfile?.github_installation_id) {
      console.log('refreshGitHubDataInternal - Already have data for handle:', handle, 'with installation ID');
      setTimeout(() => setLoading(false), 200);
      return;
    }

    try {
      setFetchInProgress(true);
      setLoading(true);
      setError(null);

      console.log('refreshGitHubDataInternal - Fetching data for:', handle);
      console.log('refreshGitHubDataInternal - GitHub installation ID:', developerProfile?.github_installation_id || 'not available');

      const installationId = developerProfile?.github_installation_id;
      console.log('Using GitHub installation ID:', installationId || 'not available');

      // If we don't have an installation ID and this isn't the initial data load, we should prompt for installation
      if (!installationId && hasExistingData) {
        console.log('No GitHub installation ID but we have data - user needs to install the GitHub App');
        setError(new Error('GitHub App not connected. Please connect the GitHub App to see your real contributions.'));
        setLoading(false);
        setFetchInProgress(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/github-proxy`;

      console.log('Calling GitHub proxy at:', apiUrl, 'with handle:', handle);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          // Send the GitHub username and installation ID to the proxy
          // The proxy will use the installation ID to authenticate with GitHub
          // if available, or fall back to public access
          handle,
          installationId // Pass the installation ID to the proxy
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
                          gitHubData.user.login?.toLowerCase() === handle.toLowerCase() && gitHubData.contributions.length > 0;
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      console.log('refreshGitHubDataInternal - GitHub data fetched successfully:', {
        user: data.user?.login || 'No user data',
        reposCount: data.repos?.length || 0,
        languagesCount: Object.keys(data.languages || {}).length,
        totalStars: data.totalStars || 0,
      console.log('refreshGitHubDataInternal - GitHub installation ID:', developerProfile?.github_installation_id || 'not available');
      });

      // Calculate contribution statistics
      const contributionStats = calculateContributionStats(data.contributions || []);

      setGitHubData({
        user: data.user || null,
        setError(new Error('GitHub App not connected. Please connect the GitHub App to see your real contributions.'));
        languages: data.languages || {},
        totalStars: data.totalStars || 0,
        contributions: data.contributions || [],
        currentStreak: contributionStats.currentStreak,
        longestStreak: contributionStats.longestStreak,
        averageContributions: contributionStats.averagePerDay
      });
      setLastFetchedHandle(handle);
      console.log('Calling GitHub proxy at:', apiUrl, 'with handle:', handle);
      if (handle === developerProfile?.github_handle && developerProfile?.user_id === user?.id) {
        await syncLanguagesToProfile();
        await syncProjectsToProfile();
      }

    } catch (err: any) {
      console.error('Error in refreshGitHubDataInternal:', err.message || err);
        body: JSON.stringify({ 
          // Send the GitHub username and installation ID to the proxy
          // The proxy will use the installation ID to authenticate with GitHub
          // if available, or fall back to public access
    } finally {
      setLoading(false);
      setFetchInProgress(false);
    }
  }, [developerProfile, user, gitHubData.user, lastFetchedHandle]);

  const refreshGitHubData = useCallback(async (handle?: string) => {
    const handleToUse = handle || developerProfile?.github_handle;
    if (!handleToUse) {
      console.log('refreshGitHubData - No GitHub handle provided or found in profile.');
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      return;
    }

    if (fetchInProgress && lastFetchedHandle === handleToUse) {
      console.log('refreshGitHubData - Fetch already in progress for handle:', handleToUse, 'Skipping duplicate request.');
      return;
    }

    await refreshGitHubDataInternal(handleToUse);
  }, [developerProfile?.github_handle, fetchInProgress, lastFetchedHandle, refreshGitHubDataInternal]);


  // Trigger refresh when handle OR installation ID changes, with a delay
  useEffect(() => {
        user: data.user?.login || 'No user data',
      console.log('useGitHub - GitHub handle changed in profile:', developerProfile.github_handle);
      console.log('useGitHub - Installation ID:', developerProfile.github_installation_id || 'not available');
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      }, 500);

      return () => clearTimeout(timer); // Cleanup timer if component unmounts or deps change
    } else if (!authLoading && !developerProfile?.github_handle) {
      console.log('useGitHub - No GitHub handle found in developer profile.');
      setGitHubData({
        user: null,
        repos: [],
        languages: {}, 
    if (developerProfile?.github_handle && !authLoading) {
        contributions: [],
      });
      
      setLoading(false);
      setError(new Error('No GitHub handle provided in your profile. Please add it.'));
    } 
  }, [developerProfile?.github_handle, developerProfile?.github_installation_id, authLoading, refreshGitHubData]);

  const getTopLanguages = useCallback((limit: number = 10): string[] => {
    console.log('getTopLanguages - Languages data:', Object.keys(gitHubData.languages).length);
    return Object.entries(gitHubData.languages)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, limit)
      .map(([language]) => language);
  }, [gitHubData.languages]);

  const getTopRepos = useCallback((limit: number = 10): GitHubRepo[] => {
    console.log('getTopRepos - Repos count:', gitHubData.repos.length);
    return gitHubData.repos
      .filter(repo => !repo.name.includes('.github.io') && !repo.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, limit);
  }, [gitHubData.repos]);

  const syncLanguagesToProfile = useCallback(async () => {
    if (!developerProfile || loading || !user || developerProfile.github_handle !== lastFetchedHandle) {
      console.log('syncLanguagesToProfile - Skipping, profile missing, loading, or handle mismatch');
      return;
    }

    const topLanguages = getTopLanguages(15);
    console.log('syncLanguagesToProfile - Top languages:', topLanguages);
    if (topLanguages.length > 0) {
      const existingLanguages = developerProfile.top_languages || [];
      const mergedLanguages = [...new Set([...existingLanguages, ...topLanguages])];

      await updateDeveloperProfile?.({
        top_languages: mergedLanguages
      });

      console.log('syncLanguagesToProfile - Updated profile with languages:', mergedLanguages.length);
    }
  }, [developerProfile, loading, user, lastFetchedHandle, getTopLanguages, updateDeveloperProfile]);

  const syncProjectsToProfile = useCallback(async () => {
    if (!developerProfile || loading || !user || developerProfile.github_handle !== lastFetchedHandle) {
      console.log('syncProjectsToProfile - Skipping, profile missing, loading, or handle mismatch');
      return;
    }

    const topRepos = getTopRepos(8).map(repo => repo.html_url);
    console.log('syncProjectsToProfile - Top repos:', topRepos.length);
    if (topRepos.length > 0) {
      const existingProjects = developerProfile.linked_projects || [];
      const uniqueProjects = [...new Set([...existingProjects, ...topRepos])];

      await updateDeveloperProfile?.({
        linked_projects: uniqueProjects
      });

      console.log('syncProjectsToProfile - Updated profile with projects:', uniqueProjects.length);
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