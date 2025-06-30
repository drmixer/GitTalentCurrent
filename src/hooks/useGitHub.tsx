import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './useAuth';

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
    loading: false,
    error: ''
  });

  useEffect(() => {
    if (developerProfile?.github_handle) {
      console.log('useGitHub - GitHub handle found:', developerProfile.github_handle);
      console.log('useGitHub - Developer profile:', {
        id: developerProfile.user_id,
        handle: developerProfile.github_handle,
        languages: developerProfile.top_languages?.length || 0
      });
      refreshGitHubData();
    } else {
      console.log('useGitHub - No GitHub handle found in developer profile');
      // Clear data if no GitHub handle
      setGitHubData({
        user: null,
        repos: [],
        languages: {},
        totalStars: 0,
        loading: false,
        error: ''
      });
    }
  }, [developerProfile?.github_handle]);

  const refreshGitHubData = async () => {
    if (!developerProfile?.github_handle) {
      console.log('refreshGitHubData - No GitHub handle provided');
      setGitHubData(prev => ({ ...prev, error: 'No GitHub handle provided' }));
      return;
    }

    try {
      console.log('refreshGitHubData - Fetching data for:', developerProfile.github_handle);
      console.log('refreshGitHubData - Starting GitHub API calls');
      setGitHubData(prev => ({ ...prev, loading: true, error: '' }));

      // Fetch GitHub user data
      const userResponse = await fetch(`https://api.github.com/users/${developerProfile.github_handle}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitTalent-App'
        }
      });
      console.log('refreshGitHubData - User API response status:', userResponse.status);
      
      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          console.error(`GitHub user '${developerProfile.github_handle}' not found`);
          throw new Error(`GitHub user '${developerProfile.github_handle}' not found`);
        } else if (userResponse.status === 403) {
          console.error('GitHub API rate limit exceeded');
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        } else {
          console.error(`GitHub API error: ${userResponse.status}`);
          throw new Error(`GitHub API error: ${userResponse.status}`);
        }
      }
      
      const userData: GitHubUser = await userResponse.json();
      console.log('refreshGitHubData - User data fetched:', userData.login);

      // Fetch user's repositories (public only)
      const reposResponse = await fetch(`https://api.github.com/users/${developerProfile.github_handle}/repos?sort=updated&per_page=100&type=public`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitTalent-App'
        }
      });
      console.log('refreshGitHubData - Repos API response status:', reposResponse.status);
      
      if (!reposResponse.ok) {
        console.error(`Failed to fetch repositories: ${reposResponse.status}`);
        throw new Error(`Failed to fetch repositories: ${reposResponse.status}`);
      }
      
      const reposData: GitHubRepo[] = await reposResponse.json();
      console.log('refreshGitHubData - Repos fetched:', reposData.length);

      // Filter out forks unless they have significant stars
      const filteredRepos = reposData.filter(repo => 
        !repo.fork || repo.stargazers_count > 5
      );

      // Calculate total stars
      const totalStars = filteredRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
      console.log('refreshGitHubData - Total stars:', totalStars);

      // Aggregate languages from repositories
      const languageStats: GitHubLanguages = {};
      
      // For each repo with a language, fetch detailed language stats
      for (const repo of filteredRepos.slice(0, 20)) { // Limit to avoid rate limiting
        if (repo.language) {
          console.log('refreshGitHubData - Processing repo language:', repo.language);
          try {
            const langResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/languages`, {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitTalent-App'
              }
            });
            console.log('refreshGitHubData - Language API response status:', langResponse.status);
            
            if (langResponse.ok) {
              const langData = await langResponse.json();
              Object.entries(langData).forEach(([lang, bytes]) => {
                languageStats[lang] = (languageStats[lang] || 0) + (bytes as number);
              });
            } else {
              console.log('refreshGitHubData - Falling back to primary language count');
              // Fallback to just counting repos by primary language
              languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
            }
            
          } catch (error) {
            // Fallback to just counting repos by primary language
            languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
          }
        }
      }

      console.log('refreshGitHubData - Languages processed:', Object.keys(languageStats).length);
      setGitHubData({
        user: userData,
        repos: filteredRepos,
        languages: languageStats,
        totalStars,
        loading: false,
        error: ''
      });

      // Automatically sync data to profile
      await syncLanguagesToProfile();
      await syncProjectsToProfile();

    } catch (error: any) {
      console.error('Error in refreshGitHubData:', error.message || error);
      setGitHubData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch GitHub data'
      }));
    }
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
    if (!developerProfile || githubData.loading) {
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
    if (!developerProfile || githubData.loading) {
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