// src/utils/profileStrengthUtils.ts

export interface ProfileStrengthData {
  bio?: string;
  location?: string;
  preferred_title?: string;
  experience_years?: number;
  github_handle?: string;
  github_installation_id?: string;
  resume_url?: string;
  profile_pic_url?: string;
  skills_categories?: Record<string, string[]>;
  linked_projects?: string[];
  desired_salary?: number;
}

export interface ProfileStrengthBreakdown {
  bio: number;
  location: number;
  preferredTitle: number;
  experience: number;
  githubHandle: number;
  githubApp: number;
  resume: number;
  skillsPoints: number;
  categoriesBonus: number;
  profilePic: number;
  salary: number;
  totalStrength: number;
  maxPossible: number;
}

/**
 * Calculate profile strength with detailed breakdown
 * Note: Projects are managed in a separate portfolio tab, so they don't contribute to profile strength
 * @param data Profile data to analyze
 * @returns Profile strength percentage (0-100) and detailed breakdown
 */
export const calculateProfileStrength = (data: ProfileStrengthData): { 
  strength: number; 
  breakdown: ProfileStrengthBreakdown;
  suggestions: string[];
} => {
  let strength = 0;
  const suggestions: string[] = [];

  // Basic Information (45 points total - increased from 40 since projects removed)
  const bioPoints = data.bio?.trim().length >= 50 ? 18 : (data.bio?.trim() ? 10 : 0);
  const locationPoints = data.location?.trim() ? 12 : 0;
  const titlePoints = data.preferred_title?.trim() ? 7 : 0;
  const experiencePoints = data.experience_years > 0 ? 8 : 0;

  strength += bioPoints + locationPoints + titlePoints + experiencePoints;

  // Add suggestions for basic info
  if (!data.bio?.trim()) {
    suggestions.push('Add a bio to describe yourself and your experience');
  } else if (data.bio.trim().length < 50) {
    suggestions.push('Expand your bio to at least 50 characters for better visibility');
  }
  
  if (!data.location?.trim()) {
    suggestions.push('Add your location to help with location-based opportunities');
  }
  
  if (!data.preferred_title?.trim()) {
    suggestions.push('Add a preferred job title to clarify your role');
  }
  
  if (!data.experience_years || data.experience_years === 0) {
    suggestions.push('Add your years of experience');
  }

  // GitHub & Professional Info (28 points total - increased from 25)
  const githubHandlePoints = data.github_handle?.trim() ? 12 : 0;
  const githubAppPoints = data.github_installation_id?.trim() ? 10 : 0;
  const resumePoints = data.resume_url?.trim() ? 6 : 0;

  strength += githubHandlePoints + githubAppPoints + resumePoints;

  // Add suggestions for GitHub & professional info
  if (!data.github_handle?.trim()) {
    suggestions.push('Add your GitHub handle to showcase your coding activity');
  }
  
  if (data.github_handle?.trim() && !data.github_installation_id?.trim()) {
    suggestions.push('Connect the GitHub app to display real-time contribution data');
  }
  
  if (!data.resume_url?.trim()) {
    suggestions.push('Upload your resume for recruiters to review');
  }

  // Skills & Technical (20 points total - same as before)
  const totalSkills = Object.values(data.skills_categories || {}).flat().length;
  let skillsPoints = 0;
  if (totalSkills >= 8) skillsPoints = 12;
  else if (totalSkills >= 5) skillsPoints = 8;
  else if (totalSkills >= 3) skillsPoints = 5;
  else if (totalSkills > 0) skillsPoints = 2;

  // Multiple skill categories bonus
  const categoriesWithSkills = Object.values(data.skills_categories || {}).filter(skills => skills.length > 0).length;
  let categoriesBonus = 0;
  if (categoriesWithSkills >= 3) categoriesBonus = 5;
  else if (categoriesWithSkills >= 2) categoriesBonus = 3;

  strength += skillsPoints + categoriesBonus;

  // Add suggestions for skills
  if (totalSkills === 0) {
    suggestions.push('Add technical skills to showcase your expertise');
  } else if (totalSkills < 5) {
    suggestions.push('Add more skills to better demonstrate your technical breadth');
  } else if (totalSkills < 8) {
    suggestions.push('Consider adding more skills to reach the recommended 8+ skills');
  }
  
  if (categoriesWithSkills < 2) {
    suggestions.push('Add skills in multiple categories to show diverse expertise');
  } else if (categoriesWithSkills < 3) {
    suggestions.push('Consider adding skills in a third category for better diversity');
  }

  // Profile Presentation (7 points total - increased from 5)
  const profilePicPoints = data.profile_pic_url?.trim() ? 4 : 0;
  const salaryPoints = data.desired_salary && data.desired_salary > 0 ? 3 : 0;

  strength += profilePicPoints + salaryPoints;

  // Add suggestions for presentation
  if (!data.profile_pic_url?.trim()) {
    suggestions.push('Add a profile picture to make your profile more personal');
  }
  
  if (!data.desired_salary || data.desired_salary === 0) {
    suggestions.push('Set your desired salary to help match with appropriate roles');
  }

  // Add portfolio-related suggestion
  suggestions.push('Complete your portfolio in the Portfolio tab to showcase your projects');

  const finalStrength = Math.min(strength, 100);
  
  const breakdown: ProfileStrengthBreakdown = {
    bio: bioPoints,
    location: locationPoints,
    preferredTitle: titlePoints,
    experience: experiencePoints,
    githubHandle: githubHandlePoints,
    githubApp: githubAppPoints,
    resume: resumePoints,
    skillsPoints,
    categoriesBonus,
    profilePic: profilePicPoints,
    salary: salaryPoints,
    totalStrength: finalStrength,
    maxPossible: 100
  };

  return {
    strength: finalStrength,
    breakdown,
    suggestions: suggestions.slice(0, 5) // Limit to top 5 suggestions
  };
};

/**
 * Get profile strength status message
 */
export const getProfileStrengthStatus = (strength: number): string => {
  if (strength >= 90) return "Outstanding! Your profile is fully optimized for recruiters";
  if (strength >= 80) return "Excellent! Your profile looks great to recruiters";
  if (strength >= 70) return "Very good! Just a few more details to perfect your profile";
  if (strength >= 60) return "Good progress! Add more details to stand out";
  if (strength >= 40) return "Getting there! Complete more sections to improve visibility";
  return "Complete more sections to improve your visibility";
};

/**
 * Get profile strength color theme
 */
export const getProfileStrengthColor = (strength: number): {
  text: string;
  bg: string;
  border: string;
} => {
  if (strength >= 80) return {
    text: 'text-emerald-600',
    bg: 'bg-emerald-600',
    border: 'border-emerald-200'
  };
  if (strength >= 60) return {
    text: 'text-blue-600',
    bg: 'bg-blue-600', 
    border: 'border-blue-200'
  };
  if (strength >= 40) return {
    text: 'text-yellow-600',
    bg: 'bg-yellow-600',
    border: 'border-yellow-200'
  };
  return {
    text: 'text-red-600',
    bg: 'bg-red-600',
    border: 'border-red-200'
  };
};
