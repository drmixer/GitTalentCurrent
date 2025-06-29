import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, GitCommit, Star, Github } from 'lucide-react';

interface GitHubChartProps {
  githubHandle: string;
  className?: string;
}

interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface GitHubStats {
  totalContributions: number;
  longestStreak: number;
  currentStreak: number;
  averagePerDay: number;
}

export const GitHubChart: React.FC<GitHubChartProps> = ({ githubHandle, className = '' }) => {
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [stats, setStats] = useState<GitHubStats>({
    totalContributions: 0,
    longestStreak: 0,
    currentStreak: 0,
    averagePerDay: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (githubHandle) {
      fetchGitHubContributions();
    }
  }, [githubHandle]);

  const fetchGitHubContributions = async () => {
    try {
      setLoading(true);
      setError('');

      // For now, we'll generate realistic-looking data based on the GitHub handle
      // In a real implementation, you would use GitHub's GraphQL API or a service
      // that provides contribution data
      
      const contributionData = generateRealisticContributions(githubHandle);
      setContributions(contributionData);
      
      const calculatedStats = calculateStats(contributionData);
      setStats(calculatedStats);
      
    } catch (error: any) {
      console.error('Error fetching GitHub contributions:', error);
      setError('Failed to load contribution data');
    } finally {
      setLoading(false);
    }
  };

  const generateRealisticContributions = (handle: string): ContributionDay[] => {
    const contributions: ContributionDay[] = [];
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    // Use the handle to seed the random number generator for consistent data
    const seed = handle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let random = seed;
    
    const seededRandom = () => {
      random = (random * 9301 + 49297) % 233280;
      return random / 233280;
    };
    
    // Generate 365 days of contribution data
    for (let i = 0; i < 365; i++) {
      const date = new Date(oneYearAgo);
      date.setDate(date.getDate() + i);
      
      // Create realistic patterns - more activity on weekdays, some breaks
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = seededRandom() < 0.05; // 5% chance of being a "holiday"
      
      let baseActivity = isWeekend ? 0.3 : 0.7;
      if (isHoliday) baseActivity *= 0.1;
      
      // Add some randomness and streaks
      const randomValue = seededRandom();
      let count = 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      
      if (randomValue < baseActivity) {
        if (randomValue < baseActivity * 0.1) {
          count = Math.floor(seededRandom() * 3) + 8; // High activity
          level = 4;
        } else if (randomValue < baseActivity * 0.3) {
          count = Math.floor(seededRandom() * 3) + 5; // Medium-high activity
          level = 3;
        } else if (randomValue < baseActivity * 0.6) {
          count = Math.floor(seededRandom() * 3) + 2; // Medium activity
          level = 2;
        } else {
          count = 1; // Low activity
          level = 1;
        }
      }
      
      contributions.push({
        date: date.toISOString().split('T')[0],
        count,
        level
      });
    }
    
    return contributions;
  };

  const calculateStats = (contributions: ContributionDay[]): GitHubStats => {
    const totalContributions = contributions.reduce((sum, day) => sum + day.count, 0);
    const averagePerDay = Math.round((totalContributions / 365) * 10) / 10;
    
    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Calculate current streak (from today backwards)
    for (let i = contributions.length - 1; i >= 0; i--) {
      if (contributions[i].count > 0) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate longest streak
    for (const day of contributions) {
      if (day.count > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    
    return {
      totalContributions,
      longestStreak,
      currentStreak,
      averagePerDay
    };
  };

  const getColorClass = (level: number): string => {
    switch (level) {
      case 0: return 'bg-gray-100';
      case 1: return 'bg-emerald-200';
      case 2: return 'bg-emerald-300';
      case 3: return 'bg-emerald-500';
      case 4: return 'bg-emerald-600';
      default: return 'bg-gray-100';
    }
  };

  const getTooltipText = (day: ContributionDay): string => {
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

  if (!githubHandle) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <Github className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Add your GitHub handle to see your contribution activity</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-53 gap-1 mb-4">
            {Array.from({ length: 365 }, (_, i) => (
              <div key={i} className="w-3 h-3 bg-gray-200 rounded-sm"></div>
            ))}
          </div>
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 rounded w-16"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <GitCommit className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Github className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-black text-gray-900">GitHub Activity</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg font-medium">
            @{githubHandle}
          </span>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg font-medium">
            Last 12 months
          </span>
        </div>
      </div>

      {/* Contribution Graph */}
      <div className="mb-6">
        <div className="grid grid-cols-53 gap-1 mb-3">
          {contributions.map((day, index) => (
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="text-xl font-black text-gray-900 mb-1">{stats.totalContributions}</div>
          <div className="text-xs font-semibold text-gray-600">Total Contributions</div>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
          <div className="text-xl font-black text-gray-900 mb-1">{stats.currentStreak}</div>
          <div className="text-xs font-semibold text-gray-600">Current Streak</div>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
          <div className="text-xl font-black text-gray-900 mb-1">{stats.longestStreak}</div>
          <div className="text-xs font-semibold text-gray-600">Longest Streak</div>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100">
          <div className="text-xl font-black text-gray-900 mb-1">{stats.averagePerDay}</div>
          <div className="text-xs font-semibold text-gray-600">Avg per Day</div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Contribution data is generated based on your GitHub handle for demonstration purposes.
        </p>
      </div>
    </div>
  );
};