import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calculateContributionStats } from '../utils/githubUtils'; // Assuming this path is correct
import { Developer } from '../types'; // For GitHubData related types, assuming Developer type might have some nested types or we need a generic GitHubData type

// Define GitHubData structure (can be imported from types if already defined there and suitable)
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


interface UseFreshGitHubDataOnceProps {
  handle: string | undefined | null;
  installationId: string | undefined | null;
}

interface UseFreshGitHubDataOnceReturn {
  gitHubData: GitHubData;
  loading: boolean;
  error: Error | null;
}

const initialState: GitHubData = {
  user: null,
  repos: [],
  languages: {},
  totalStars: 0,
  contributions: [],
  currentStreak: 0,
  longestStreak: 0,
  averageContributions: 0,
};

export const useFreshGitHubDataOnce = ({ handle, installationId }: UseFreshGitHubDataOnceProps): UseFreshGitHubDataOnceReturn => {
  const [gitHubData, setGitHubData] = useState<GitHubData>(initialState);
  // Initial loading state true only if handle is present, otherwise false.
  const [loading, setLoading] = useState<boolean>(false); // Initialize loading to false
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const fetchDataInternal = async () => {
      if (!handle || !installationId) { // Guard against missing props
        if (isMounted) {
          setGitHubData(initialState);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      console.log(`[useFreshGitHubDataOnce] fetchDataInternal: Fetching for handle: ${handle}, installationId: ${installationId}`);

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/github-proxy`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
          body: JSON.stringify({ handle, installationId }),
          signal: controller.signal // Pass abort signal
      });

        if (!isMounted) return; // Check after await

      console.log(`[useFreshGitHubDataOnce] Response for ${handle}: ok=${response.ok}, status=${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
          if (!isMounted) return; // Check after await
        console.error(`[useFreshGitHubDataOnce] Fetch error for ${handle}:`, errorText);
        let errorMessage = `GitHub API error: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
            if (errorData.error) errorMessage = errorData.error;
          } catch (e) { errorMessage = errorText; }
        throw new Error(errorMessage);
      }

        const data = await response.json();
        if (!isMounted) return; // Check after await

        console.log(`[useFreshGitHubDataOnce] fetchDataInternal: Data received for ${handle}:`, data);
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
        setError(null);

      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[useFreshGitHubDataOnce] Fetch aborted.');
          // No state update needed if fetch was aborted due to unmount
        } else if (isMounted) { // Only update state if still mounted and not an abort error
          console.error(`[useFreshGitHubDataOnce] fetchDataInternal: Caught error for ${handle}:`, err);
          setError(err);
          setGitHubData(initialState);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (handle && installationId) {
      fetchDataInternal();
    } else {
      // If props are not ready, ensure hook is in a clean non-loading state.
      setGitHubData(initialState);
      setLoading(false);
      setError(null);
    }

    return () => {
      isMounted = false;
      controller.abort(); // Abort fetch on unmount
      console.log(`[useFreshGitHubDataOnce] Unmounting or deps changed for handle: ${handle}, installationId: ${installationId}. Aborting fetch.`);
    };
  }, [handle, installationId]);

  return { gitHubData, loading, error };
};
