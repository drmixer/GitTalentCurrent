import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  loading: boolean;
  error: string;
}

interface GitHubContextType extends GitHubData {
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
  const { user, developerProfile, updateDeveloperProfile } = useAuth();
  const [githubData, setGitHubData] = useState<GitHubData>({
    user: null,
    repos: [],
    languages: {},
    totalStars: 0,
    contributions: [],
    loading: false,
    error: ''
  });
  const [currentHandle, setCurrentHandle] = useState<string | null>(null); 
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [lastFetchedHandle, setLastFetchedHandle] = useState<string | null>(null);

  useEffect(() => {
    if (developerProfile?.github_handle) {
      console.log('useGitHub - GitHub handle found:', developerProfile.github_handle);
      console.log('useGitHub - Developer profile:', {
        id: developerProfile.user_id,
        handle: developerProfile.github_handle,
        languages: developerProfile.top_languages?.length || 0
      });
      refreshGitHubData(developerProfile.github_handle);
    } else {
      console.log('useGitHub - No GitHub handle found in developer profile');
      // Clear data if no GitHub handle
      setGitHubData({
        user: null,
        repos: [],
        languages: {},
        totalStars: 0,
        contributions: [],
        loading: false,
        error: 'No GitHub handle provided'
      });
    }
  }, [developerProfile?.github_handle]);

  const refreshGitHubDataInternal = async (handle: string) => {
    if (!handle) {
      console.log('refreshGitHubDataInternal - No GitHub handle provided');
      setGitHubData(prev => ({
        ...prev,
        loading: false,
        error: 'No GitHub handle provided'
      }));
      setFetchInProgress(false);
      return;
    }

    // Prevent multiple simultaneous fetches for the same handle
    if (fetchInProgress && currentHandle === handle) {
      console.log('refreshGitHubDataInternal - Fetch already in progress for:', handle);
      return;
    }

    // If we already have data for this handle, don't fetch again
    if (lastFetchedHandle === handle && githubData.user && githubData.user.login.toLowerCase() === handle.toLowerCase()) {
      console.log('refreshGitHubDataInternal - Already have data for handle:', handle);
      return;
    }

    try {
      setFetchInProgress(true);
      console.log('refreshGitHubDataInternal - Fetching data for:', handle);
      setGitHubData(prev => ({ ...prev, loading: true, error: '' }));
      setCurrentHandle(handle);

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
        user: data.user,
        repos: data.repos || [],
        languages: data.languages || {},
        totalStars: data.totalStars || 0,
        contributions: data.contributions || [],
        loading: false,
        error: '',
      });
      setLastFetchedHandle(handle);

      // Automatically sync data to profile
      if (handle === developerProfile?.github_handle) {
        await syncLanguagesToProfile();
        await syncProjectsToProfile();
      }
      
    } catch (error: any) {
      console.error('Error in refreshGitHubDataInternal:', error.message || error);
      setGitHubData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch GitHub data'
      }));
    } finally {
      setFetchInProgress(false);
    }
  };

  const refreshGitHubData = async (handle?: string) => {
    const handleToUse = handle || developerProfile?.github_handle;
    if (!handleToUse) {
      console.log('refreshGitHubData - No GitHub handle provided or found in profile');
      setGitHubData(prev => ({ 
        ...prev, 
        error: 'No GitHub handle provided',
        loading: false 
      }));
      return;
    }
    
    // If we're already fetching data for this handle, don't start another fetch
    if (fetchInProgress && currentHandle === handleToUse) {
      console.log('refreshGitHubData - Fetch already in progress for handle:', handleToUse);
      return;
    }
    
    // If we already have data for this handle, don't fetch again
    if (lastFetchedHandle === handleToUse && githubData.user && githubData.user.login.toLowerCase() === handleToUse.toLowerCase()) {
      console.log('refreshGitHubData - Already have data for handle:', handleToUse);
      return;
    }
    
    await refreshGitHubDataInternal(handleToUse);
  };

  const getTopLanguages = (limit: number = 10): string[] => {
    console.log('getTopLanguages - Languages data:', Object.keys(githubData.languages).length);
    return Object.entries(githubData.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([language]) => language);
  };

  const getTopRepos = (limit: number = 10): GitHubRepo[] => {
    console.log('getTopRepos - Repos count:', githubData.repos.length);
    return githubData.repos
      .filter(repo => !repo.name.includes('.github.io') && !repo.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, limit);
  };

  const syncLanguagesToProfile = async () => {
    if (!developerProfile || githubData.loading || currentHandle !== developerProfile.github_handle) {
      console.log('syncLanguagesToProfile - Skipping, profile missing or loading');
      return;
    }
    
    const topLanguages = getTopLanguages(15);
    console.log('syncLanguagesToProfile - Top languages:', topLanguages);
    if (topLanguages.length > 0) {
      // Merge with existing languages, removing duplicates
      const existingLanguages = developerProfile.top_languages || [];
      const mergedLanguages = [...new Set([...existingLanguages, ...topLanguages])];
      
      await updateDeveloperProfile?.({
        top_languages: mergedLanguages
      });
      
      console.log('syncLanguagesToProfile - Updated profile with languages:', mergedLanguages.length);
    }
  };

  const syncProjectsToProfile = async () => {
    if (!developerProfile || githubData.loading || currentHandle !== developerProfile.github_handle) {
      console.log('syncProjectsToProfile - Skipping, profile missing or loading');
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
  };

  const value = {
    ...githubData,
    refreshGitHubData,
    getTopLanguages,
    getTopRepos,
    syncLanguagesToProfile,
    syncProjectsToProfile
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};