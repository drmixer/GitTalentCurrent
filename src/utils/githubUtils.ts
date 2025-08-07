/**
 * Utility functions for GitHub data processing
 */

/**
 * Calculate statistics from GitHub contribution data
 */
export const calculateContributionStats = (contributions: any) => {
  // Handle both array format and object format
  let contributionArray = [];
  
  if (Array.isArray(contributions)) {
    // Old format: direct array
    contributionArray = contributions;
  } else if (contributions && typeof contributions === 'object' && Array.isArray(contributions.calendar)) {
    // New format: object with calendar property
    contributionArray = contributions.calendar.map(day => ({
      date: day.date,
      count: day.contributionCount || day.count || 0,
      level: Math.min(Math.floor((day.contributionCount || day.count || 0) / 5), 4)
    }));
  } else {
    // Invalid or empty data
    return {
      totalContributions: 0,
      currentStreak: 0,
      longestStreak: 0,
      averagePerDay: 0
    };
  }

  if (!contributionArray || contributionArray.length === 0) {
    return {
      totalContributions: 0,
      currentStreak: 0,
      longestStreak: 0,
      averagePerDay: 0
    };
  }

  // Calculate total contributions
  const totalContributions = contributionArray.reduce((sum, day) => sum + (day.count || 0), 0);
  
  // Calculate current streak (from most recent day backwards)
  let currentStreak = 0;
  for (let i = contributionArray.length - 1; i >= 0; i--) {
    if (contributionArray[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  for (const day of contributionArray) {
    if (day.count > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  // Calculate average contributions per day
  const averagePerDay = Math.round((totalContributions / contributionArray.length) * 10) / 10;
  
  return {
    totalContributions,
    currentStreak,
    longestStreak,
    averagePerDay
  };
};

/**
 * Get color class for contribution level
 */
export const getContributionColorClass = (level: number): string => {
  switch (level) {
    case 0: return 'bg-gray-100';
    case 1: return 'bg-emerald-200';
    case 2: return 'bg-emerald-300';
    case 3: return 'bg-emerald-500';
    case 4: return 'bg-emerald-600';
    default: return 'bg-gray-100';
  }
};

/**
 * TIMEZONE FIX: Helper function to parse GitHub dates as UTC
 */
function parseGitHubDateAsUTC(dateString: string): Date {
  // GitHub returns dates like "2024-08-06" which should be treated as UTC
  // Adding 'T00:00:00Z' ensures it's parsed as UTC, not local timezone
  return new Date(`${dateString}T00:00:00Z`);
}

/**
 * Get tooltip text for contribution day
 * TIMEZONE FIX: Parse date as UTC to avoid timezone offset issues
 */
export const getContributionTooltipText = (day: { date: string; count: number }): string => {
  // TIMEZONE FIX: Parse as UTC instead of local timezone
  const date = parseGitHubDateAsUTC(day.date);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'UTC' // TIMEZONE FIX: Format in UTC to match the parsed date
  });
  
  if (day.count === 0) {
    return `No contributions on ${formattedDate}`;
  } else if (day.count === 1) {
    return `1 contribution on ${formattedDate}`;
  } else {
    return `${day.count} contributions on ${formattedDate}`;
  }
};

/**
 * Calculate percentage for a language
 */
export const calculateLanguagePercentage = (languages: Record<string, number>, language: string): number => {
  if (!languages || Object.keys(languages).length === 0) return 0;
  
  const total = Object.values(languages).reduce((sum, bytes) => sum + (bytes as number), 0);
  const percentage = ((languages[language] as number) / total) * 100;
  return Math.round(percentage);
};

/**
 * Get color class for language based on index
 */
export const getLanguageColorClass = (index: number): string => {
  const colors = ['bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500'];
  return colors[index % colors.length];
};
