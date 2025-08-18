// src/types/index.ts

import { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
  id: string;
  role: 'admin' | 'recruiter' | 'developer';
  name: string;
  email: string;
  is_approved: boolean;
  created_at: string;
  avatar_url: string | null;
  profile_pic_url: string | null;
}

export interface SkillCategory {
  [category: string]: {
    skills: string[];
    proficiency: 'beginner' | 'intermediate' | 'expert';
    company_name: string; // Kept as in your original file
  };
}

// UPDATED: Expand preferences to support a per-type map while keeping existing fields
export interface NotificationPreferences {
  email: boolean;
  in_app: boolean;
  // Optional granular flags by type; if omitted, treat as allowed (true) by default
  types?: {
    message?: boolean;
    job_application?: boolean;
    test_assignment?: boolean;
    test_completion?: boolean;
    endorsement?: boolean; // NEW: allows opting out of endorsement notifications
    application_viewed?: boolean;
    hired?: boolean;
  };
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
  lastProfileUpdateTime?: number | null;
  createDeveloperProfile?: (profileData: Partial<Developer>) => Promise<boolean>;
  updateDeveloperProfile?: (profileData: Partial<Developer>) => Promise<boolean>;
  createJobRole?: (jobData: Partial<JobRole>) => Promise<any>;
  updateJobRole?: (jobId: string, jobData: Partial<JobRole>) => Promise<any>;
  createAssignment?: (assignmentData: Partial<Assignment>) => Promise<boolean>;
  importJobsFromCSV?: (jobsData: Partial<JobRole>[]) => Promise<{success: number, failed: number}>;
  createHire?: (hireData: Partial<Hire>) => Promise<boolean>;
  updateUserApprovalStatus?: (userId: string, isApproved: boolean) => Promise<boolean>;
  // NEW: Add the GitHub callback success handler
  handleGitHubCallbackSuccess?: (sessionData: any, developerProfileData?: any) => Promise<{ success?: boolean; error?: any }>;
}

export interface Developer {
  user_id: string;
  github_handle: string | null;
  bio: string | null;
  availability: boolean | null;
  top_languages: string[] | null;
  linked_projects: string[] | null;
  location: string | null;
  experience_years: number | null;
  desired_salary: number | null;
  skills_categories: SkillCategory | null;
  profile_strength: number | null;
  public_profile_slug: string | null;
  notification_preferences: NotificationPreferences | null;
  resume_url?: string | null;
  profile_pic_url?: string | null;
  github_installation_id?: string | null;
  created_at: string;
  updated_at: string;
  user: User; // Made mandatory as it's always joined in fetches

  // New fields for the snapshot card / existing fields for consistency
  title?: string | null;
  skills?: string[] | null;
  public_repos_count?: number | null;
  annual_contributions?: number | null;

  // Fields for Overview tab snapshot cards
  endorsements_count?: number | null;
  saved_jobs_count?: number | null;
  applied_jobs_count?: number | null;
  public_profile_enabled?: boolean | null;

  // NEW: used by profile-strength util
  public_endorsement_count?: number | null;
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
  created_at: string;
  developer_id: string;
  endorser_id: string | null;
  endorser_email: string | null;
  endorser_role: string | null;
  comment: string;
  skill: string;
  is_anonymous: boolean;
  is_public: boolean;

  // NEW: provided name when the endorser isn't logged in
  endorser_name?: string | null;

  endorser_user: {
    name: string;
    developers: {
      public_profile_slug: string;
    }[];
  } | null;
}

export interface SavedJob {
  id: string;
  developer_id: string;
  job_id: string;
  saved_at: string;
  job_role?: JobRole;
}

export interface AppliedJob {
  id: string;
  developer_id: string;
  job_id: string;
  applied_at: string;
  status: 'applied' | 'viewed' | 'interviewing' | 'offer' | 'rejected' | 'archived';
  job_role?: JobRole;
  developer?: Developer;
}

export interface Recruiter {
  user_id: string;
  company_name: string;
  website: string | null;
  company_size: string | null;
  industry: string | null;
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
  job_type: string;
  tech_stack: string[] | null;
  salary: string | null;
  experience_required: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  created_at: string;
  updated_at: string;
  recruiter?: Recruiter; // Optional, as it's a joined field.

  responsibilities?: string[] | null;
  benefits?: string[] | null;
}

export interface CSVJobImport {
  title: string;
  description: string;
  location: string;
  job_type: string;
  tech_stack: string;
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
  assigned_by: string; // User ID of the recruiter who made the assignment
  assigned_at: string;
  updated_at: string;
  notes: string;
  has_recruiter_contact?: boolean;
  developer?: Developer; // Can include joined Developer
  job_role?: JobRole;   // Can include joined JobRole
  recruiter?: Recruiter; // Can include joined Recruiter, added for MarkAsHiredModal display
}

// Define SavedCandidate as an Assignment where developer, job_role, and recruiter
// are guaranteed to be present for dashboard display and modal usage.
import { TestAssignment } from './index';

export interface SavedCandidate extends Assignment {
    developer: Developer; // Make developer non-optional
    job_role: JobRole;   // Make job_role non-optional
    recruiter: Recruiter; // Make recruiter non-optional for the modal's agreement text
    test_assignment?: TestAssignment;
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
  // Align with live schema: prefer message_preview, keep message optional for backward compat
  message?: string;
  message_preview?: string;
  is_read: boolean;
  created_at: string;
}

export interface CodingTest {
    id: string;
    title: string;
    description: string;
    role: string;
    difficulty: string;
    created_at: string;
    updated_at: string;
}

export interface CodingQuestion {
    id: string;
    test_id: string;
    title: string;
    question_text: string;
    language: string;
    starter_code?: string;
    expected_output?: string;
    test_cases?: { stdin: string; expected_output: string }[];
    created_at: string;
    updated_at: string;
}

export interface TestAssignment {
    id: string;
    developer_id: string;
    job_id: string;
    test_id: string;
    status: string;
    created_at: string;
    updated_at: string;
    coding_tests: CodingTest;
}

export interface TestResult {
    id: string;
    assignment_id: string;
    question_id: string;
    score: number;
    stdout: string;
    stderr: string;
    passed_test_cases: number;
    total_test_cases: number;
    created_at: string;
}
