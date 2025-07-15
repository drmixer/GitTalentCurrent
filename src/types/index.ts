export interface User {
  id: string;
  role: 'admin' | 'recruiter' | 'developer';
  name: string;
  email: string;
  is_approved: boolean;
  created_at: string;
}

export interface SkillCategory {
  [category: string]: {
    skills: string[];
    proficiency: 'beginner' | 'intermediate' | 'expert';
    company_name: string;
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
  createJobRole?: (jobData: Partial<JobRole>) => Promise<boolean>; 
  updateJobRole?: (jobId: string, jobData: Partial<JobRole>) => Promise<boolean>; 
  createAssignment?: (assignmentData: Partial<Assignment>) => Promise<boolean>; 
  importJobsFromCSV?: (jobsData: Partial<JobRole>[]) => Promise<{success: number, failed: number}>; 
  createHire?: (hireData: Partial<Hire>) => Promise<boolean>; 
  updateUserApprovalStatus?: (userId: string, isApproved: boolean) => Promise<boolean>; 
}

export interface Developer {
  user_id: string;
  github_handle: string;
  bio: string;
  availability: boolean;
  top_languages: string[];
  skills: string[];
  linked_projects: string[];
  location: string;
  experience_years: number;
  desired_salary: number;
  skills_categories: SkillCategory;
  profile_strength: number;
  public_profile_slug: string;
  notification_preferences: NotificationPreferences;
  resume_url?: string;
  profile_pic_url?: string;
  github_installation_id?: string;
  created_at: string;
  updated_at: string;
  user?: User;

  // New fields for the snapshot card
  title?: string;                   // Developer's job title
  skills?: string[];                // Core skills
  public_repos_count?: number;      // GitHub public repositories count
  annual_contributions?: number;    // GitHub contributions in the last year

  // Fields for Overview tab snapshot cards
  endorsements_count?: number;
  saved_jobs_count?: number;
  applied_jobs_count?: number;
  public_profile_enabled?: boolean; // For public/private toggle
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
}

export interface Recruiter {
  user_id: string;
  company_name: string;
  website: string;
  company_size: string;
  industry: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface JobRole {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  location: string;
  job_type: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance';
  tech_stack: string[];
  salary_min: number;
  salary_max: number;
  experience_required: string;
  is_active: boolean;
  is_featured?: boolean;
  created_at: string;
  updated_at: string;
  recruiter?: Recruiter;
}

export interface CSVJobImport {
  title: string;
  description: string;
  location: string;
  job_type: string;
  tech_stack: string;
  salary_min: number | string;
  salary_max: number | string;
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