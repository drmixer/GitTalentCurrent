import React from 'react';
import { Github, Star, GitFork, Users, MapPin, Link as LinkIcon, TrendingUp, Calendar } from 'lucide-react';

// Assuming GitHubData and related types are defined elsewhere and imported
// For now, defining a minimal version here based on what RealGitHubChart uses from useGitHub
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
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
  avatar_url: string;
}

interface GitHubData {
  user: GitHubUser | null;
  repos: GitHubRepo[];
  totalStars: number; // This is on the top-level GitHubData from useGitHub
  longestStreak?: number;
  averageContributions?: number;
  // contributions and languages are not directly used by this component, but part of GitHubData
}

interface GitHubUserActivityDetailsProps {
  gitHubData: GitHubData | null; // Allow null if data might not be loaded
}

export const GitHubUserActivityDetails: React.FC<GitHubUserActivityDetailsProps> = ({ gitHubData }) => {
  if (!gitHubData || !gitHubData.user) {
    // Can show a loading state or a message if data is not available
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
        <p className="text-gray-500">GitHub user details are not available or still loading.</p>
      </div>
    );
  }

  const { user, repos, longestStreak, averageContributions, totalStars } = gitHubData;

  // Get top 3 non-forked repositories, sorted by stars
  const topRepos = repos
    .filter(repo => !repo.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 3);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border h-full space-y-6">
      {/* User Info Section */}
      <div className="flex items-start space-x-4">
        <img
          src={user.avatar_url}
          alt={`${user.login} avatar`}
          className="w-20 h-20 rounded-full border-2 border-gray-200 shadow-md"
        />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{user.name || user.login}</h2>
          <p className="text-sm text-gray-500">@{user.login}</p>
          {user.bio && <p className="mt-2 text-gray-700 text-sm">{user.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
            {user.location && (
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-1.5 text-gray-400" />
                {user.location}
              </div>
            )}
            {user.blog && (
              <a
                href={user.blog.startsWith('http') ? user.blog : `https://${user.blog}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-blue-600 hover:underline"
              >
                <LinkIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                {user.blog}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Followers/Following and Public Repos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center border-t border-b border-gray-100 py-4">
        <div>
          <div className="text-xl font-bold text-gray-900">{user.followers}</div>
          <div className="text-xs font-medium text-gray-500">Followers</div>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900">{user.following}</div>
          <div className="text-xs font-medium text-gray-500">Following</div>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900">{user.public_repos}</div>
          <div className="text-xs font-medium text-gray-500">Public Repos</div>
        </div>
      </div>

      {/* Additional Stats Section */}
      {(typeof longestStreak !== 'undefined' || typeof averageContributions !== 'undefined') && (
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">Contribution Stats</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {typeof longestStreak !== 'undefined' && (
              <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                <div className="flex items-center justify-center mb-1">
                    <Calendar className="w-5 h-5 text-purple-600 mr-2" />
                    <span className="text-xl font-black text-gray-900">{longestStreak} days</span>
                </div>
                <div className="text-xs font-semibold text-gray-600 text-center">Longest Streak</div>
              </div>
            )}
            {typeof averageContributions !== 'undefined' && (
               <div className="p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100">
                <div className="flex items-center justify-center mb-1">
                    <TrendingUp className="w-5 h-5 text-orange-600 mr-2" />
                    <span className="text-xl font-black text-gray-900">{averageContributions}</span>
                </div>
                <div className="text-xs font-semibold text-gray-600 text-center">Avg Contribs/Day</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Repositories Section */}
      {topRepos.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">Top Repositories</h4>
          <div className="space-y-3">
            {topRepos.map((repo) => (
              <a
                key={repo.id}
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-blue-600 truncate hover:underline">{repo.name}</span>
                  <div className="flex items-center text-xs text-gray-500">
                    <Star className="w-3.5 h-3.5 mr-1 text-yellow-500" />
                    {repo.stargazers_count}
                  </div>
                </div>
                {repo.description && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">{repo.description}</p>
                )}
                {repo.language && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {repo.language}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
