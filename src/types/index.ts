// src/types/index.ts

import { User as SupabaseUser } from '@supabase/supabase-js'; // Assuming you import SupabaseUser somewhere

export interface User {
  id: string;
  role: 'admin' | 'recruiter' | 'developer';
  name: string;
  email: string;
  is_approved: boolean;
  created_at: string;
  avatar_url: string | null;      // Added for profile pictures (used as company logo fallback)
  profile_pic_url: string | null;  // Added as another potential profile pic URL
}

export interface SkillCategory {
  [category: string]: {
    skills: string[];
    proficiency: 'beginner' | 'intermediate' | 'expert';
    company_name: string; // This seems odd for a SkillCategory, might need review but keeping as is
  };
}

export interface NotificationPreferences {
  email: boolean;
  in_app: boolean;
  assignments: boolean;
  messages: boolean;
}

export interface GitHubUser {
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

export interface GitHubRepo {
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

export interface GitHubLanguages {
  [key: string]: number;
}

export interface AuthContextType {
  user: SupabaseUser | null;
  userProfile: User | null;
  developerProfile?: Developer | null;
  authError: string | null;
  loading: boolean;
  needsOnboarding?: boolean;
  signIn: (email: string, password: string) => Promise<{ user: SupabaseUser | null, error: any | null }>;
  signInWithGitHub: (stateParams?: Record<string, any>) => Promise<{ error: any | null }>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<{ data?: any, error: any | null }>;
  signOut: () => Promise<{ error: any | null }>;
  refreshProfile?: () => Promise<void>;
  setResolvedDeveloperProfile?: (developerData: Developer) => void;
  lastProfileUpdateTime?: number | null; // Added for explicit refresh signal
  createDeveloperProfile?: (profileData: Partial<Developer>) => Promise<boolean>;
  updateDeveloperProfile?: (profileData: Partial<Developer>) => Promise<boolean>;
  createJobRole?: (jobData: Partial<JobRole>) => Promise<any>;
  updateJobRole?: (jobId: string, jobData: Partial<JobRole>) => Promise<any>;
  createAssignment?: (assignmentData: Partial<Assignment>) => Promise<boolean>;
  importJobsFromCSV?: (jobsData: Partial<JobRole>[]) => Promise<{success: number, failed: number}>;
  createHire?: (hireData: Partial<Hire>) => Promise<boolean>;
  updateUserApprovalStatus?: (userId: string, isApproved: boolean) => Promise<boolean>;
}

export interface Developer {
  user_id: string;
  github_handle: string | null;        // Changed to nullable
  bio: string | null;                   // Changed to nullable
  availability: boolean | null;         // Changed to nullable
  top_languages: string[] | null;       // Changed to nullable
  linked_projects: string[] | null;     // Changed to nullable
  location: string | null;              // Changed to nullable
  experience_years: number | null;      // Changed to nullable
  desired_salary: number | null;        // Changed to nullable
  skills_categories: SkillCategory | null; // Changed to nullable
  profile_strength: number | null;      // Changed to nullable
  public_profile_slug: string | null;   // Changed to nullable
  notification_preferences: NotificationPreferences | null; // Changed to nullable
  resume_url?: string | null;
  profile_pic_url?: string | null;
  github_installation_id?: string | null;
  created_at: string;
  updated_at: string;
  user: User; // Made mandatory as it's always joined in fetches

  // New fields for the snapshot card / existing fields for consistency
  title?: string | null;                // Developer's job title, from preferred_title
  skills?: string[] | null;             // Core skills (from DB)
  public_repos_count?: number | null;   // GitHub public repositories count
  annual_contributions?: number | null; // GitHub contributions in the last year

  // Fields for Overview tab snapshot cards
  endorsements_count?: number | null;
  saved_jobs_count?: number | null;
  applied_jobs_count?: number | null;
  public_profile_enabled?: boolean | null; // For public/private toggle
}

export interface PortfolioItem {
  id: string;
  developer_id: string;
  title: string;
  description?: string;
  url?: string;
  image_url?: string;
  category: 'project' | 'article' | 'certification' | 'other';
  technologies: string[];
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface Endorsement {
  id: string;
  endorser_id: string; // User ID of the person giving endorsement
  developer_id: string; // User ID of the developer being endorsed
  text: string;
  created_at: string;
  endorser?: User; // Optional: for displaying endorser info
}

export interface SavedJob {
  id: string;
  developer_id: string;
  job_id: string;
  saved_at: string;
  job_role?: JobRole; // Optional: for displaying job info
}

export interface AppliedJob {
  id: string;
  developer_id: string;
  job_id: string;
  applied_at: string;
  status: 'applied' | 'viewed' | 'interviewing' | 'offer' | 'rejected' | 'archived';
  job_role?: JobRole; // Optional: for displaying job info
  developer?: Developer; // Added: Represents the joined developer object
}

export interface Recruiter {
  user_id: string;
  company_name: string;
  website: string | null;       // Changed to nullable based on your schema
  company_size: string | null;  // Changed to nullable based on your schema
  industry: string | null;      // Changed to nullable based on your schema
  created_at: string;
  updated_at: string;
  user: User; // Made mandatory as it's always joined in fetches
}

export interface JobRole {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  location: string;
  job_type: string;                  // Changed from enum to string as per your DB schema
  tech_stack: string[] | null;       // Changed to string[] | null as per your DB schema
  salary: string | null;             // Changed to string | null as per your DB schema
  experience_required: string | null; // Changed to string | null as per your DB schema
  is_active: boolean | null;         // Changed to boolean | null as per your DB schema
  is_featured: boolean | null;       // Changed to boolean | null as per your DB schema
  created_at: string;
  updated_at: string;
  recruiter?: Recruiter;             // Optional, as it's a joined field.

  responsibilities?: string[] | null; // Added (if intended/future)
  benefits?: string[] | null;         // Added (if intended/future)
}

export interface CSVJobImport {
  title: string;
  description: string;
  location: string;
  job_type: string;
  tech_stack: string; // Note: if imported as string, might need parsing to string[]
  salary: string;
  experience_required?: string;
  is_active?: boolean | string;
}

export interface Assignment {
  id: string;
  developer_id: string;
  job_role_id: string;
  recruiter_id: string;
  status: 'New' | 'Contacted' | 'Shortlisted' | 'Hired' | 'Rejected';
  assigned_by: string;
  assigned_at: string;
  updated_at: string;
  notes: string;
  has_recruiter_contact?: boolean;
  developer?: Developer;
  job_role?: JobRole;
  recruiter?: Recruiter;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  job_role_id?: string;
  assignment_id?: string;
  subject: string;
  body: string;
  sent_at: string;
  read_at?: string;
  is_read: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  sender?: User;
  receiver?: User;
  job_role?: JobRole;
}

export interface Hire {
  id: string;
  assignment_id: string;
  salary: number;
  hire_date: string;
  start_date?: string;
  notes: string;
  marked_by: string;
  created_at: string;
  assignment?: Assignment;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  entity_id: string;
  entity_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
