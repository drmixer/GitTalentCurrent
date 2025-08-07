/**
 * Utility functions for GitHub data processing
 */

/**
 * Helper function to normalize contribution data dates and ensure consistency
 */
export function normalizeContributionData(contributions: any[]): any[] {
  if (!Array.isArray(contributions)) return [];
  
  return contributions.map(day => {
    // Ensure we have a consistent date format
    let normalizedDate = day.date;
    
    // If the date includes time information, strip it to get just YYYY-MM-DD
    if (normalizedDate && normalizedDate.includes('T')) {
      normalizedDate = normalizedDate.split('T')[0];
    }
    
    // Ensure we have a consistent count field
    const count = day.contributionCount || day.count || 0;
    
    // Calculate level based on count (GitHub uses 0-4 scale)
    const level = Math.min(Math.floor(count / 5), 4);
    
    return {
      date: normalizedDate,
      count: count,
      contributionCount: count, // Keep both for compatibility
      level: level
    };
  });
}

/**
 * Calculate statistics from GitHub contribution data
 */
export const calculateContributionStats = (contributions: any) => {
  // Handle both array format and object format
  let contributionArray = [];
  
  if (Array.isArray(contributions)) {
    // Old format: direct array - normalize the data
    contributionArray = normalizeContributionData(contributions);
  } else if (contributions && typeof contributions === 'object' && Array.isArray(contributions.calendar)) {
    // New format: object with calendar property
    contributionArray = normalizeContributionData(contributions.calendar.map(day => ({
      date: day.date,
      count: day.contributionCount || day.count || 0,
      contributionCount: day.contributionCount || day.count || 0,
      level: Math.min(Math.floor((day.contributionCount || day.count || 0) / 5), 4)
    })));
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

  // Sort contributions by date to ensure proper chronological order
  contributionArray.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate total contributions
  const totalContributions = contributionArray.reduce((sum, day) => sum + (day.count || 0), 0);
  
  // Calculate current streak (from most recent day backwards)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Filter to only include days up to today
  const validDays = contributionArray.filter(day => day.date <= todayStr);
  
  let currentStreak = 0;
  for (let i = validDays.length - 1; i >= 0; i--) {
    if (validDays[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  for (const day of validDays) {
    if (day.count > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  // Calculate average contributions per day
  const averagePerDay = validDays.length > 0 
    ? Math.round((totalContributions / validDays.length) * 10) / 10 
    : 0;
  
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
export const getContributionTooltipText = (day: { date: string; count?: number; contributionCount?: number }): string => {
  const count = day.count || day.contributionCount || 0;
  
  // Parse the date and format it properly, ensuring we don't add timezone offset
  const date = new Date(day.date + 'T00:00:00');
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  if (count === 0) {
    return `No contributions on ${formattedDate}`;
  } else if (count === 1) {
    return `1 contribution on ${formattedDate}`;
  } else {
    return `${count} contributions on ${formattedDate}`;
  }
};

/**
 * Calculate percentage for a language
 */
export const calculateLanguagePercentage = (languages: Record<string, number>, language: string): number => {
  if (!languages || Object.keys(languages).length === 0) return 0;
  
  const total = Object.values(languages).reduce((sum, bytes) => sum + (bytes as number), 0);
  if (total === 0) return 0;
  
  const percentage = ((languages[language] as number) / total) * 100;
  return Math.round(percentage);
};

/**
 * Get color class for language based on index
 */
export const getLanguageColorClass = (index: number): string => {
  const colors = [
    'bg-blue-500',
    'bg-yellow-500', 
    'bg-green-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500'
  ];
  
  return colors[index % colors.length] || 'bg-gray-500';
};
