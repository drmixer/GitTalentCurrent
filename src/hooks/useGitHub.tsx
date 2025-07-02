import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'; // Added useCallback
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

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
  // Removed loading and error from here as they are part of the hook's state directly
}

interface GitHubContextType {
  gitHubData: GitHubData; // Now holds all the fetched data
  loading: boolean; // Loading state for the hook
  error: Error | null; // Error state for the hook
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
  const { user, developerProfile, updateDeveloperProfile, loading: authLoading } = useAuth(); // Get authLoading

  const [gitHubData, setGitHubData] = useState<GitHubData>({ // Renamed to gitHubData for clarity
    user: null,
    repos: [],
    languages: {},
    totalStars: 0,
    contributions: [],
  });
  const [loading, setLoading] = useState(true); // Overall loading state for this hook
  const [error, setError] = useState<Error | null>(null); // Overall error state for this hook
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [lastFetchedHandle, setLastFetchedHandle] = useState<string | null>(null);

  // Use useCallback to memoize refreshGitHubDataInternal
  const refreshGitHubDataInternal = useCallback(async (handle: string) => {
    if (!handle) {
      console.log('refreshGitHubDataInternal - No GitHub handle provided');
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      setFetchInProgress(false);
      return;
    }

    // Prevent multiple simultaneous fetches for the same handle
    if (fetchInProgress) { // Removed currentHandle check here, as it's handled by lastFetchedHandle
      console.log('refreshGitHubDataInternal - Fetch already in progress for:', handle);
      return;
    }

    // If we already have data for this handle, don't fetch again unless explicitly refreshed
    if (lastFetchedHandle === handle && gitHubData.user && gitHubData.user.login.toLowerCase() === handle.toLowerCase()) {
      console.log('refreshGitHubDataInternal - Already have data for handle:', handle);
      setLoading(false); // Ensure loading is false if data is already present
      return;
    }

    try {
      setFetchInProgress(true);
      setLoading(true); // Start loading
      setError(null); // Clear any previous errors

      console.log('refreshGitHubDataInternal - Fetching data for:', handle);

      // Get the GitHub installation ID from the developer profile
      const installationId = developerProfile?.github_installation_id;
      console.log('Using GitHub installation ID:', installationId || 'not available');

      // Call the Supabase Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/github-proxy`;

      console.log('Calling GitHub proxy at:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
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
          // If parsing fails, use the raw text
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      console.log('refreshGitHubDataInternal - GitHub data fetched successfully:', {
        user: data.user?.login,
        reposCount: data.repos?.length || 0,
        languagesCount: Object.keys(data.languages || {}).length,
        totalStars: data.totalStars
      });

      setGitHubData({
        user: data.user || null, // Ensure user is null if not provided
        repos: data.repos || [],
        languages: data.languages || {},
        totalStars: data.totalStars || 0,
        contributions: data.contributions || [],
      });
      setLastFetchedHandle(handle);

      // Automatically sync data to profile
      if (handle === developerProfile?.github_handle && developerProfile?.user_id === user?.id) { // Added user?.id check
        await syncLanguagesToProfile();
        await syncProjectsToProfile();
      }

    } catch (err: any) {
      console.error('Error in refreshGitHubDataInternal:', err.message || err);
      setError(err); // Set the error state
      // Do not clear githubData here, keep previous valid data if any
    } finally {
      setLoading(false); // End loading
      setFetchInProgress(false);
    }
  }, [developerProfile, user, gitHubData.user, lastFetchedHandle]); // Added gitHubData.user and lastFetchedHandle to dependencies

  // Use useCallback for refreshGitHubData as well
  const refreshGitHubData = useCallback(async (handle?: string) => {
    const handleToUse = handle || developerProfile?.github_handle;
    if (!handleToUse) {
      console.log('refreshGitHubData - No GitHub handle provided or found in profile');
      setLoading(false);
      setError(new Error('No GitHub handle provided'));
      return;
    }

    // This check is now mostly handled by refreshGitHubDataInternal's internal logic
    // but keep it as a guard for external calls
    if (fetchInProgress && lastFetchedHandle === handleToUse) { // Use lastFetchedHandle here
      console.log('refreshGitHubData - Fetch already in progress for handle:', handleToUse);
      return;
    }

    await refreshGitHubDataInternal(handleToUse);
  }, [developerProfile?.github_handle, fetchInProgress, lastFetchedHandle, refreshGitHubDataInternal]);


  // Initial fetch when developerProfile is loaded or changes
  useEffect(() => {
    if (developerProfile?.github_handle) {
      console.log('useGitHub - GitHub handle found in developer profile:', developerProfile.github_handle);
      refreshGitHubData(developerProfile.github_handle);
    } else if (!authLoading && !developerProfile?.github_handle) { // Only set error if auth is done and no handle
      console.log('useGitHub - No GitHub handle found in developer profile');
      setGitHubData({ // Clear data and set error if no GitHub handle
        user: null,
        repos: [],
        languages: {},
        totalStars: 0,
        contributions: [],
      });
      setLoading(false);
      setError(new Error('No GitHub handle provided in your profile. Please add it.'));
    }
  }, [developerProfile?.github_handle, authLoading, refreshGitHubData]); // Added authLoading to dependencies

  // Memoized helper functions
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
    if (!developerProfile || loading || !user || developerProfile.github_handle !== lastFetchedHandle) { // Check user and lastFetchedHandle
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
  }, [developerProfile, loading, user, lastFetchedHandle, getTopLanguages, updateDeveloperProfile]); // Added dependencies

  const syncProjectsToProfile = useCallback(async () => {
    if (!developerProfile || loading || !user || developerProfile.github_handle !== lastFetchedHandle) { // Check user and lastFetchedHandle
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
  }, [developerProfile, loading, user, lastFetchedHandle, getTopRepos, updateDeveloperProfile]); // Added dependencies


  const value = {
    gitHubData, // Expose the combined data object
    loading, // Expose loading state
    error, // Expose error state
    refreshGitHubData,
    getTopLanguages,
    getTopRepos,
    syncLanguagesToProfile,
    syncProjectsToProfile
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};
