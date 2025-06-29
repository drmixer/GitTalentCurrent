import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './useAuth';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string;
  topics: string[];
  updated_at: string;
}

interface GitHubUser {
  login: string;
  name: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  location: string;
  blog: string;
  company: string;
  avatar_url: string;
}

interface GitHubLanguages {
  [key: string]: number;
}

interface GitHubData {
  user: GitHubUser | null;
  repos: GitHubRepo[];
  languages: GitHubLanguages;
  totalStars: number;
  loading: boolean;
  error: string;
}

interface GitHubContextType extends GitHubData {
  refreshGitHubData: () => Promise<void>;
  getTopLanguages: (limit?: number) => string[];
  getTopRepos: (limit?: number) => GitHubRepo[];
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
  const { user, developerProfile } = useAuth();
  const [githubData, setGitHubData] = useState<GitHubData>({
    user: null,
    repos: [],
    languages: {},
    totalStars: 0,
    loading: false,
    error: ''
  });

  useEffect(() => {
    if (developerProfile?.github_handle) {
      refreshGitHubData();
    }
  }, [developerProfile?.github_handle]);

  const refreshGitHubData = async () => {
    if (!developerProfile?.github_handle) {
      setGitHubData(prev => ({ ...prev, error: 'No GitHub handle provided' }));
      return;
    }

    try {
      setGitHubData(prev => ({ ...prev, loading: true, error: '' }));

      // Fetch GitHub user data
      const userResponse = await fetch(`https://api.github.com/users/${developerProfile.github_handle}`);
      if (!userResponse.ok) {
        throw new Error(`GitHub user not found: ${userResponse.status}`);
      }
      const userData: GitHubUser = await userResponse.json();

      // Fetch user's repositories
      const reposResponse = await fetch(`https://api.github.com/users/${developerProfile.github_handle}/repos?sort=updated&per_page=100`);
      if (!reposResponse.ok) {
        throw new Error(`Failed to fetch repositories: ${reposResponse.status}`);
      }
      const reposData: GitHubRepo[] = await reposResponse.json();

      // Calculate total stars
      const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);

      // Aggregate languages from repositories
      const languageStats: GitHubLanguages = {};
      reposData.forEach(repo => {
        if (repo.language) {
          languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
        }
      });

      setGitHubData({
        user: userData,
        repos: reposData,
        languages: languageStats,
        totalStars,
        loading: false,
        error: ''
      });

    } catch (error: any) {
      console.error('Error fetching GitHub data:', error);
      setGitHubData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch GitHub data'
      }));
    }
  };

  const getTopLanguages = (limit: number = 10): string[] => {
    return Object.entries(githubData.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([language]) => language);
  };

  const getTopRepos = (limit: number = 10): GitHubRepo[] => {
    return githubData.repos
      .filter(repo => !repo.name.includes('.github.io') && repo.stargazers_count > 0)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, limit);
  };

  const value = {
    ...githubData,
    refreshGitHubData,
    getTopLanguages,
    getTopRepos
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};