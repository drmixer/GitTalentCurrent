export interface User {
  id: string;
  role: 'admin' | 'recruiter' | 'developer';
  name: string;
  email: string;
  is_approved: boolean;
  created_at: string;
}

export interface Developer {
  user_id: string;
  github_handle: string;
  bio: string;
  availability: boolean;
  top_languages: string[];
  linked_projects: string[];
  user?: User;
}

export interface Recruiter {
  user_id: string;
  company_name: string;
  website?: string;
  user?: User;
}

export interface JobRole {
  id: string;
  recruiter_id: string;
  title: string;
  location: string;
  job_type: string;
  tech_stack: string[];
  salary_min?: number;
  salary_max?: number;
  description: string;
  created_at: string;
  recruiter?: Recruiter;
}

export interface Assignment {
  id: string;
  developer_id: string;
  job_role_id: string;
  recruiter_id: string;
  status: 'New' | 'Shortlisted' | 'Contacted' | 'Hired';
  assigned_by: string;
  assigned_at: string;
  developer?: Developer;
  job_role?: JobRole;
  recruiter?: Recruiter;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  job_role_id?: string;
  body: string;
  sent_at: string;
  read_at?: string;
  sender?: User;
  receiver?: User;
  job_role?: JobRole;
}

export interface Hire {
  id: string;
  assignment_id: string;
  salary: number;
  hire_date: string;
  notes?: string;
  marked_by: string;
  assignment?: Assignment;
}