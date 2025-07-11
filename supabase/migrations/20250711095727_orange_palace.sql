/*
  # Create GitTalent Database Schema
  
  1. New Tables
    - `users` - Core user information linked to auth.users
    - `developers` - Developer-specific profile information
    - `recruiters` - Recruiter-specific information
    - `job_roles` - Job listings
    - `saved_jobs` - Jobs saved by developers
    - `applied_jobs` - Job applications by developers
    - `endorsements` - Endorsements given to developers
    - `portfolio_items` - Developer portfolio projects
    - `messages` - Messages between users
  
  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- 1. users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  avatar_url TEXT,
  title TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON public.users 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Auth users can read public user info" ON public.users 
  FOR SELECT TO authenticated USING (true);

-- 2. developers Table
CREATE TABLE IF NOT EXISTS public.developers (
  user_id UUID PRIMARY KEY NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  github_handle TEXT UNIQUE,
  bio TEXT,
  availability BOOLEAN DEFAULT true,
  top_languages TEXT[],
  linked_projects TEXT[],
  location TEXT,
  experience_years INTEGER,
  desired_salary INTEGER,
  skills_categories JSONB,
  profile_strength INTEGER,
  public_profile_slug TEXT UNIQUE,
  public_profile_enabled BOOLEAN DEFAULT true,
  notification_preferences JSONB,
  resume_url TEXT,
  profile_pic_url TEXT,
  github_installation_id TEXT,
  annual_contributions INTEGER,
  endorsements_count INTEGER DEFAULT 0,
  saved_jobs_count INTEGER DEFAULT 0,
  applied_jobs_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own profile" ON public.developers 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read dev profiles if enabled" ON public.developers 
  FOR SELECT USING (public_profile_enabled = true);

-- 3. recruiters Table
CREATE TABLE IF NOT EXISTS public.recruiters (
  user_id UUID PRIMARY KEY NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT,
  company_size TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.recruiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters manage own profile" ON public.recruiters 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth can read recruiter company names" ON public.recruiters 
  FOR SELECT TO authenticated USING (true);

-- 4. job_roles Table
CREATE TABLE IF NOT EXISTS public.job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  job_type TEXT NOT NULL,
  tech_stack TEXT[],
  salary_min INTEGER,
  salary_max INTEGER,
  experience_required TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraint for job_type
ALTER TABLE public.job_roles ADD CONSTRAINT job_roles_job_type_check 
  CHECK (job_type IN ('Full-time', 'Part-time', 'Contract', 'Freelance'));

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active job_roles" ON public.job_roles 
  FOR SELECT USING (is_active = true);

CREATE POLICY "Recruiters manage own job_roles" ON public.job_roles 
  FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

-- 5. saved_jobs Table
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (developer_id, job_id)
);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own saved_jobs" ON public.saved_jobs 
  FOR ALL USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);

-- 6. applied_jobs Table
CREATE TABLE IF NOT EXISTS public.applied_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'applied' NOT NULL,
  UNIQUE (developer_id, job_id)
);

ALTER TABLE public.applied_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own applied_jobs" ON public.applied_jobs 
  FOR ALL USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);

-- 7. endorsements Table
CREATE TABLE IF NOT EXISTS public.endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  endorser_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read endorsements" ON public.endorsements 
  FOR SELECT USING (true);

CREATE POLICY "Auth users can create endorsements" ON public.endorsements 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users manage own given endorsements" ON public.endorsements 
  FOR UPDATE, DELETE USING (auth.uid() = endorser_id) WITH CHECK (auth.uid() = endorser_id);

-- 8. portfolio_items Table
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  image_url TEXT,
  category TEXT NOT NULL,
  technologies TEXT[],
  featured BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraint for category
ALTER TABLE public.portfolio_items ADD CONSTRAINT portfolio_items_category_check 
  CHECK (category IN ('project', 'article', 'certification', 'other'));

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own portfolio_items" ON public.portfolio_items 
  FOR ALL USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);

CREATE POLICY "Public read public portfolio_items" ON public.portfolio_items 
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM developers d 
    WHERE d.user_id = portfolio_items.developer_id AND d.public_profile_enabled = true
  ));

-- 9. messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_role_id UUID REFERENCES public.job_roles(id) ON DELETE SET NULL,
  assignment_id UUID,
  subject TEXT,
  body TEXT NOT NULL CHECK (char_length(body) > 0),
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  read_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own messages" ON public.messages 
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id) 
  WITH CHECK (auth.uid() = sender_id);

-- Create indexes for better performance
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);

CREATE INDEX idx_developers_user_id ON public.developers(user_id);
CREATE INDEX idx_developers_github_handle ON public.developers(github_handle);
CREATE INDEX idx_developers_availability ON public.developers(availability);
CREATE INDEX idx_developers_public_profile_slug ON public.developers(public_profile_slug);

CREATE INDEX idx_recruiters_user_id ON public.recruiters(user_id);

CREATE INDEX idx_job_roles_recruiter ON public.job_roles(recruiter_id);
CREATE INDEX idx_job_roles_active ON public.job_roles(is_active);

CREATE INDEX idx_saved_jobs_developer_id ON public.saved_jobs(developer_id);
CREATE INDEX idx_saved_jobs_job_id ON public.saved_jobs(job_id);

CREATE INDEX idx_applied_jobs_developer_id ON public.applied_jobs(developer_id);
CREATE INDEX idx_applied_jobs_job_id ON public.applied_jobs(job_id);
CREATE INDEX idx_applied_jobs_status ON public.applied_jobs(status);

CREATE INDEX idx_endorsements_developer_id ON public.endorsements(developer_id);
CREATE INDEX idx_endorsements_endorser_id ON public.endorsements(endorser_id);

CREATE INDEX idx_portfolio_items_developer ON public.portfolio_items(developer_id);
CREATE INDEX idx_portfolio_items_featured ON public.portfolio_items(featured);

CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX idx_messages_read ON public.messages(is_read);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_developers_updated_at
BEFORE UPDATE ON public.developers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recruiters_updated_at
BEFORE UPDATE ON public.recruiters
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_roles_updated_at
BEFORE UPDATE ON public.job_roles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();