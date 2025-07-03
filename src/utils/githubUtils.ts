/**
 * Utility functions for GitHub data processing
 */

/**
 * Calculate statistics from GitHub contribution data
 */
export const calculateContributionStats = (contributions: { date: string; count: number; level: number }[]) => {
  if (!contributions || contributions.length === 0) {
    return {
      totalContributions: 0,
      currentStreak: 0,
      longestStreak: 0,
      averagePerDay: 0
    };
  }

  // Calculate total contributions
  const totalContributions = contributions.reduce((sum, day) => sum + day.count, 0);
  
  // Calculate current streak (from most recent day backwards)
  let currentStreak = 0;
  for (let i = contributions.length - 1; i >= 0; i--) {
    if (contributions[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  for (const day of contributions) {
    if (day.count > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  // Calculate average contributions per day
  const averagePerDay = Math.round((totalContributions / contributions.length) * 10) / 10;
  
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
 * Get tooltip text for contribution day
 */
export const getContributionTooltipText = (day: { date: string; count: number }): string => {
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