import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calculateContributionStats } from '../utils/githubUtils';
import { Developer } from '../types';

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

export const usePublicGitHub = (developer?: Developer) => {
  const [gitHubData, setGitHubData] = useState<GitHubData>({
    user: null,
    repos: [],
    languages: {},
    totalStars: 0,
    contributions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshGitHubData = useCallback(async (developerToFetch?: Developer) => {
    const targetDeveloper = developerToFetch || developer;
    console.log("usePublicGitHub: targetDeveloper", targetDeveloper);
    if (!targetDeveloper?.github_handle) {
      setError(new Error('No GitHub handle provided'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { github_handle, github_installation_id } = targetDeveloper;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/github-proxy`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          handle: github_handle,
          installationId: github_installation_id
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
      console.log("usePublicGitHub: data", data);
      console.log("usePublicGitHub: data.user", data.user);
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
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [developer]);

  useEffect(() => {
    if (developer?.github_handle) {
      refreshGitHubData(developer);
    }
  }, [developer, developer?.github_installation_id, refreshGitHubData]);

  return {
    gitHubData,
    loading,
    error,
    refreshGitHubData,
  };
};
