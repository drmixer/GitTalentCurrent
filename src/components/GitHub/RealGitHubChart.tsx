import React, { useState, useEffect } from 'react';
import { Star, GitFork, ExternalLink, Loader, AlertCircle, RefreshCw, Github } from 'lucide-react';
import { useGitHub } from '../../hooks/useGitHub';

interface RealGitHubChartProps {
  githubHandle: string;
  className?: string;
}

export const RealGitHubChart: React.FC<RealGitHubChartProps> = ({ githubHandle, className = '' }) => {
  const { 
    user: githubUser, 
    repos, 
    totalStars, 
    languages, 
    contributions,
    loading, 
    error, 
    refreshGitHubData 
  } = useGitHub();

  console.log('RealGitHubChart - Rendering with handle:', githubHandle || 'none');
  console.log('RealGitHubChart - GitHub data:', { 
    userLoaded: !!githubUser, 
    reposCount: repos.length, 
    loading, 
    error: error || 'none' 
  });

  useEffect(() => {
    if (githubHandle) {
      console.log('RealGitHubChart - GitHub handle effect triggered:', githubHandle);
      refreshGitHubData(githubHandle);
    }
  }, [githubHandle]);

  const getColorClass = (level: number): string => {
    switch (level) {
      case 0: return 'bg-gray-100 hover:bg-gray-200';
      case 1: return 'bg-emerald-200 hover:bg-emerald-300';
      case 2: return 'bg-emerald-300 hover:bg-emerald-400';
      case 3: return 'bg-emerald-500 hover:bg-emerald-600';
      case 4: return 'bg-emerald-600 hover:bg-emerald-700';
      default: return 'bg-gray-100 hover:bg-gray-200';
    }
  };

  const getTooltipText = (day: { date: string; count: number }): string => {
    const date = new Date(day.date);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    if (day.count === 0) {
      return `No contributions on ${formattedDate}`;
    } else if (day.count === 1) {
      return `1 contribution on ${formattedDate}`;
    } else {
      return `${day.count} contributions on ${formattedDate}`;
    }
  };

  // Calculate stats from contributions
  const totalContributions = contributions?.reduce((sum, day) => sum + day.count, 0) || 0;
  
  const currentStreak = (() => {
    if (!contributions || contributions.length === 0) return 0;
    let streak = 0;
    for (let i = contributions.length - 1; i >= 0; i--) {
      if (contributions[i].count > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  })();

  const longestStreak = (() => {
    if (!contributions || contributions.length === 0) return 0;
    let maxStreak = 0;
    let currentStreakCount = 0;
    
    contributions.forEach(day => {
      if (day.count > 0) {
        currentStreakCount++;
        maxStreak = Math.max(maxStreak, currentStreakCount);
      } else {
        currentStreakCount = 0;
      }
    });
    
    return maxStreak;
  })();

  // Calculate average contributions per day
  const averagePerDay = contributions?.length 
    ? Math.round((totalContributions / contributions.length) * 10) / 10 
    : 0;

  // Get top languages
  const topLanguages = Object.entries(languages || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  
  // Calculate total bytes for percentage calculation
  const totalBytes = topLanguages.reduce((sum, [, bytes]) => sum + bytes, 0);

  if (!githubHandle) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden transform hover:scale-105 transition-all duration-500 ${className}`}>
        <div className="text-center text-gray-500 py-12">
          <Github className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">No GitHub handle provided</p>
          <p className="text-xs text-gray-400 mt-2">Developer needs to add their GitHub username</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden transform hover:scale-105 transition-all duration-500 ${className}`}>
        <div className="bg-gradient-to-r from-gray-50 to-slate-100 px-8 py-6 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Loader className="w-8 h-8 text-white animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-gray-900">Loading...</h3>
              <p className="text-sm font-medium text-gray-600">@{githubHandle}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden transform hover:scale-105 transition-all duration-500 ${className}`}>
        <div className="bg-gradient-to-r from-gray-50 to-slate-100 px-8 py-6 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-gray-900">GitHub Error</h3>
              <p className="text-sm font-medium text-gray-600">@{githubHandle}</p>
            </div>
          </div>
        </div>
        <div className="px-8 py-6">
          <div className="bg-red-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button 
            onClick={() => refreshGitHubData(githubHandle)} 
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!githubUser) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden transform hover:scale-105 transition-all duration-500 ${className}`}>
        <div className="bg-gradient-to-r from-gray-50 to-slate-100 px-8 py-6 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-gray-500 to-gray-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Github className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-gray-900">Not Found</h3>
              <p className="text-sm font-medium text-gray-600">@{githubHandle}</p>
            </div>
          </div>
        </div>
        <div className="px-8 py-6">
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-600">GitHub data not available for this user. The handle may be incorrect or the GitHub API may be experiencing issues.</p>
          </div>
          <button 
            onClick={() => refreshGitHubData(githubHandle)} 
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden transform hover:scale-105 transition-all duration-500 ${className}`}>
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-100 px-8 py-6 border-b border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
              {githubUser.avatar_url ? (
                <img 
                  src={githubUser.avatar_url} 
                  alt={githubUser.login} 
                  className="w-16 h-16 object-cover"
                />
              ) : (
                <Github className="w-8 h-8 text-white" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-white flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black text-gray-900">{githubHandle}</h3>
            <p className="text-sm font-medium text-gray-600">{githubUser.name || 'GitHub User'}</p>
            <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
              <div className="flex items-center">
                <GitFork className="w-3 h-3 mr-1" />
                <span className="font-medium">{githubUser.public_repos} repos</span>
              </div>
              <div className="flex items-center">
                <Star className="w-3 h-3 mr-1" />
                <span className="font-medium">{totalStars} stars</span>
              </div>
            </div>
          </div>

          <div>
            <a
              href={`https://github.com/${githubHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors"
            >
              View Profile
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>
      </div>

      {/* Contribution Activity */}
      <div className="px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-sm font-bold text-gray-900">Contribution Activity</h4>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">Last 12 months</span>
        </div>
        
        {/* Contribution Graph */}
        <div className="mb-6">
          <div className="grid grid-cols-12 gap-1 mb-3">
            {contributions?.slice(0, 84).map((day, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-sm ${getColorClass(day.level)} hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all duration-200 hover:scale-110`}
                title={getTooltipText(day)}
              />
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium">Less</span>
            <div className="flex items-center space-x-1">
              <div className="w-2.5 h-2.5 bg-gray-100 rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-emerald-200 rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-emerald-300 rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-emerald-600 rounded-sm"></div>
            </div>
            <span className="font-medium">More</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-6 text-center">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
            <div className="text-2xl font-black text-gray-900">{githubUser.public_repos}</div>
            <div className="text-xs font-semibold text-gray-600">Repositories</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
            <div className="text-2xl font-black text-gray-900">{totalContributions}</div>
            <div className="text-xs font-semibold text-gray-600">Contributions</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 border border-yellow-100">
            <div className="flex items-center justify-center mb-1">
              <Star className="w-4 h-4 text-yellow-500 mr-1" />
              <div className="text-2xl font-black text-gray-900">{totalStars}</div>
            </div>
            <div className="text-xs font-semibold text-gray-600">Stars Earned</div>
          </div>
        </div>

        {/* Language Stats */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-4">Top Languages</h4>
          <div className="space-y-3">
            {topLanguages.map(([language, bytes], index) => {
              const percentage = Math.round((bytes / totalBytes) * 100);
              const colorClass = index === 0 ? "bg-blue-500" : 
                               index === 1 ? "bg-yellow-500" : 
                               index === 2 ? "bg-green-500" : 
                               "bg-purple-500";
              return (
                <div key={language} className="flex items-center text-sm">
                  <div className={`w-3 h-3 rounded-full mr-3 ${colorClass}`}></div>
                  <span className="text-gray-700 flex-1 font-medium">{language}</span>
                  <span className="text-gray-900 font-bold">{percentage}%</span>
                </div>
              );
            })}
          </div>
          
          {/* Language Progress Bar */}
          <div className="flex mt-4 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            {topLanguages.map(([language, bytes], index) => {
              const percentage = (bytes / totalBytes) * 100;
              const colorClass = index === 0 ? "bg-blue-500" : 
                               index === 1 ? "bg-yellow-500" : 
                               index === 2 ? "bg-green-500" : 
                               "bg-purple-500";
              return (
                <div 
                  key={language}
                  className={colorClass} 
                  style={{ width: `${percentage}%` }}
                ></div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};