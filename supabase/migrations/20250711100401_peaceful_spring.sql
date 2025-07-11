/*
  # Create GitTalent Database Schema
  
  1. Core User and Profile Tables
    - users: Basic user information linked to auth.users
    - developers: Developer-specific profile information
    - recruiters: Recruiter-specific information
  
  2. Job Roles and Interaction Tables
    - job_roles: Job listings
    - saved_jobs: Jobs saved by developers
    - applied_jobs: Job applications by developers
  
  3. Endorsements, Portfolio, and Messages Tables
    - endorsements: Endorsements given to developers
    - portfolio_items: Developer portfolio projects
    - messages: Messages between users
*/

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Core User and Profile Tables

-- users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'recruiter', 'developer')),
  avatar_url TEXT,
  title TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" 
  ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Auth users can read public user info" 
  ON public.users 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- developers Table
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
  notification_preferences JSONB DEFAULT '{"email": true, "in_app": true, "messages": true, "assignments": true}'::jsonb,
  resume_url TEXT,
  profile_pic_url TEXT,
  github_installation_id TEXT,
  annual_contributions INTEGER,
  endorsements_count INTEGER DEFAULT 0,
  saved_jobs_count INTEGER DEFAULT 0,
  applied_jobs_count INTEGER DEFAULT 0,
  profile_view_count INTEGER DEFAULT 0,
  search_appearance_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own profile" 
  ON public.developers 
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read dev profiles if enabled" 
  ON public.developers 
  FOR SELECT 
  USING (public_profile_enabled = true);

-- Create trigger for developers.updated_at
CREATE TRIGGER update_developers_updated_at
  BEFORE UPDATE ON public.developers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- recruiters Table
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

CREATE POLICY "Recruiters manage own profile" 
  ON public.recruiters 
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth can read recruiter company names" 
  ON public.recruiters 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Create trigger for recruiters.updated_at
CREATE TRIGGER update_recruiters_updated_at
  BEFORE UPDATE ON public.recruiters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Job Roles and Interaction Tables

-- job_roles Table
CREATE TABLE IF NOT EXISTS public.job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('Full-time', 'Part-time', 'Contract', 'Freelance')),
  tech_stack TEXT[],
  salary_min INTEGER,
  salary_max INTEGER,
  experience_required TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active job_roles" 
  ON public.job_roles 
  FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Recruiters manage own job_roles" 
  ON public.job_roles 
  FOR ALL 
  USING (auth.uid() = recruiter_id) 
  WITH CHECK (auth.uid() = recruiter_id);

-- Create trigger for job_roles.updated_at
CREATE TRIGGER update_job_roles_updated_at
  BEFORE UPDATE ON public.job_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for job_roles
CREATE INDEX idx_job_roles_recruiter ON public.job_roles(recruiter_id);
CREATE INDEX idx_job_roles_active ON public.job_roles(is_active);

-- saved_jobs Table
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (developer_id, job_id)
);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own saved_jobs" 
  ON public.saved_jobs 
  FOR ALL 
  USING (auth.uid() = developer_id) 
  WITH CHECK (auth.uid() = developer_id);

-- Create indexes for saved_jobs
CREATE INDEX idx_saved_jobs_developer_id ON public.saved_jobs(developer_id);
CREATE INDEX idx_saved_jobs_job_id ON public.saved_jobs(job_id);

-- applied_jobs Table
CREATE TABLE IF NOT EXISTS public.applied_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'applied' NOT NULL,
  UNIQUE (developer_id, job_id)
);

ALTER TABLE public.applied_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own applied_jobs" 
  ON public.applied_jobs 
  FOR ALL 
  USING (auth.uid() = developer_id) 
  WITH CHECK (auth.uid() = developer_id);

-- Create indexes for applied_jobs
CREATE INDEX idx_applied_jobs_developer_id ON public.applied_jobs(developer_id);
CREATE INDEX idx_applied_jobs_job_id ON public.applied_jobs(job_id);
CREATE INDEX idx_applied_jobs_status ON public.applied_jobs(status);

-- 3. Endorsements, Portfolio, and Messages Tables

-- endorsements Table
CREATE TABLE IF NOT EXISTS public.endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  endorser_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read endorsements" 
  ON public.endorsements 
  FOR SELECT 
  USING (true);

CREATE POLICY "Auth users can create endorsements" 
  ON public.endorsements 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users manage own given endorsements" 
  ON public.endorsements 
  FOR UPDATE, DELETE 
  USING (auth.uid() = endorser_id) 
  WITH CHECK (auth.uid() = endorser_id);

-- Create indexes for endorsements
CREATE INDEX idx_endorsements_developer_id ON public.endorsements(developer_id);
CREATE INDEX idx_endorsements_endorser_id ON public.endorsements(endorser_id);

-- portfolio_items Table
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  image_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('project', 'article', 'certification', 'other')),
  technologies TEXT[],
  featured BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs manage own portfolio_items" 
  ON public.portfolio_items 
  FOR ALL 
  USING (auth.uid() = developer_id) 
  WITH CHECK (auth.uid() = developer_id);

CREATE POLICY "Public read public portfolio_items" 
  ON public.portfolio_items 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM developers d 
    WHERE d.user_id = portfolio_items.developer_id 
    AND d.public_profile_enabled = true
  ));

-- Create trigger for portfolio_items.updated_at
CREATE TRIGGER update_portfolio_items_updated_at
  BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for portfolio_items
CREATE INDEX idx_portfolio_items_developer ON public.portfolio_items(developer_id);
CREATE INDEX idx_portfolio_items_featured ON public.portfolio_items(featured);

-- messages Table
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

CREATE POLICY "Users manage own messages" 
  ON public.messages 
  FOR ALL 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id) 
  WITH CHECK (auth.uid() = sender_id);

-- Create indexes for messages
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX idx_messages_read ON public.messages(is_read);

-- 4. Additional Tables for Assignments and Hires

-- assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_role_id UUID NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Shortlisted', 'Hired', 'Rejected')),
  assigned_by UUID NOT NULL REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT ''
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all assignments" 
  ON public.assignments 
  FOR ALL 
  TO authenticated 
  USING (is_admin());

CREATE POLICY "Recruiters can update assignment status" 
  ON public.assignments 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Users can read own assignments" 
  ON public.assignments 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = developer_id OR auth.uid() = recruiter_id OR is_admin());

-- Create trigger for assignments.updated_at
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for assignments
CREATE INDEX idx_assignments_developer ON public.assignments(developer_id);
CREATE INDEX idx_assignments_job_role ON public.assignments(job_role_id);
CREATE INDEX idx_assignments_recruiter ON public.assignments(recruiter_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);

-- hires Table
CREATE TABLE IF NOT EXISTS public.hires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  salary INTEGER NOT NULL,
  hire_date TIMESTAMPTZ DEFAULT NOW(),
  start_date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  marked_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all hires" 
  ON public.hires 
  FOR ALL 
  TO authenticated 
  USING (is_admin());

CREATE POLICY "Recruiters can create hires" 
  ON public.hires 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.id = hires.assignment_id 
    AND a.recruiter_id = auth.uid()
  ));

CREATE POLICY "Users can read relevant hires" 
  ON public.hires 
  FOR SELECT 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.id = hires.assignment_id 
    AND (a.developer_id = auth.uid() OR a.recruiter_id = auth.uid())
  ) OR is_admin());

-- 5. Notifications Table

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  entity_id UUID,
  entity_type TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all notifications" 
  ON public.notifications 
  FOR ALL 
  TO authenticated 
  USING (is_admin());

CREATE POLICY "Users can read own notifications" 
  ON public.notifications 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
  ON public.notifications 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create indexes for notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_entity_id ON public.notifications(entity_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- 6. Helper Functions

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is recruiter
CREATE OR REPLACE FUNCTION is_recruiter()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'recruiter'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is developer
CREATE OR REPLACE FUNCTION is_developer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'developer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user ID
CREATE OR REPLACE FUNCTION uid()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a developer can message a recruiter
CREATE OR REPLACE FUNCTION can_message(sender_id UUID, receiver_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sender_role TEXT;
  receiver_role TEXT;
BEGIN
  -- Get sender and receiver roles
  SELECT role INTO sender_role FROM users WHERE id = sender_id;
  SELECT role INTO receiver_role FROM users WHERE id = receiver_id;
  
  -- Admin can message anyone
  IF sender_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Anyone can message admin
  IF receiver_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Recruiter can message developer
  IF sender_role = 'recruiter' AND receiver_role = 'developer' THEN
    RETURN TRUE;
  END IF;
  
  -- Developer can message recruiter only if recruiter has messaged them first
  IF sender_role = 'developer' AND receiver_role = 'recruiter' THEN
    RETURN EXISTS (
      SELECT 1 FROM messages
      WHERE sender_id = receiver_id AND receiver_id = sender_id
    );
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_as_read()
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Notification Triggers

-- Function to handle message notifications
CREATE OR REPLACE FUNCTION handle_message_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for the receiver
  INSERT INTO notifications (user_id, type, entity_id, entity_type, message)
  VALUES (
    NEW.receiver_id,
    'message',
    NEW.id,
    'messages',
    CASE
      WHEN NEW.job_role_id IS NOT NULL THEN
        (SELECT 'New message from ' || u.name || ' about job: ' || jr.title
         FROM users u, job_roles jr
         WHERE u.id = NEW.sender_id AND jr.id = NEW.job_role_id)
      ELSE
        (SELECT 'New message from ' || name FROM users WHERE id = NEW.sender_id)
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for message notifications
CREATE TRIGGER message_notification_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION handle_message_notification();

-- Function to handle job interest notifications
CREATE OR REPLACE FUNCTION handle_job_interest_notification()
RETURNS TRIGGER AS $$
DECLARE
  job_title TEXT;
  developer_name TEXT;
  recruiter_id UUID;
BEGIN
  -- Only create notification if message has job_role_id
  IF NEW.job_role_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get job title and recruiter_id
  SELECT title, recruiter_id INTO job_title, recruiter_id
  FROM job_roles
  WHERE id = NEW.job_role_id;
  
  -- Get developer name
  SELECT name INTO developer_name
  FROM users
  WHERE id = NEW.sender_id;
  
  -- If sender is developer and receiver is recruiter who owns the job
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.sender_id AND role = 'developer'
  ) AND recruiter_id = NEW.receiver_id THEN
    -- Insert job interest notification
    INSERT INTO notifications (user_id, type, entity_id, entity_type, message)
    VALUES (
      recruiter_id,
      'job_interest',
      NEW.job_role_id,
      'job_roles',
      developer_name || ' expressed interest in your job: ' || job_title
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for job interest notifications
CREATE TRIGGER job_interest_notification_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION handle_job_interest_notification();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user record in public.users
  INSERT INTO public.users (id, name, email, role, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'developer'),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'developer') = 'developer' THEN true
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'developer') = 'admin' THEN true
      ELSE false -- recruiters need approval
    END
  );
  
  -- If role is developer, create developer profile
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'developer') = 'developer' THEN
    INSERT INTO public.developers (
      user_id,
      github_handle,
      bio,
      location,
      profile_pic_url
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'user_name',
      NEW.raw_user_meta_data->>'bio',
      NEW.raw_user_meta_data->>'location',
      NEW.raw_user_meta_data->>'avatar_url'
    );
  END IF;
  
  -- If role is recruiter, create recruiter profile
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'developer') = 'recruiter' THEN
    INSERT INTO public.recruiters (
      user_id,
      company_name
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company')
    );
    
    -- Notify admins about new recruiter
    INSERT INTO notifications (
      user_id,
      type,
      entity_id,
      entity_type,
      message
    )
    SELECT
      id,
      'new_recruiter',
      NEW.id,
      'users',
      'New recruiter signup: ' || COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'New User') || ' from ' || COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company')
    FROM users
    WHERE role = 'admin';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to create user profile via RPC
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_role TEXT,
  company_name TEXT DEFAULT NULL
)
RETURNS SETOF users AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_user_record users;
BEGIN
  -- Check if user already exists
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = user_id
  ) INTO v_user_exists;
  
  IF v_user_exists THEN
    -- Return existing user
    RETURN QUERY SELECT * FROM users WHERE id = user_id;
  ELSE
    -- Create new user
    INSERT INTO users (id, email, name, role, is_approved)
    VALUES (
      user_id,
      user_email,
      user_name,
      user_role,
      CASE
        WHEN user_role = 'developer' THEN true
        WHEN user_role = 'admin' THEN true
        ELSE false -- recruiters need approval
      END
    )
    RETURNING * INTO v_user_record;
    
    -- If role is developer, create developer profile
    IF user_role = 'developer' THEN
      INSERT INTO developers (user_id)
      VALUES (user_id);
    END IF;
    
    -- If role is recruiter, create recruiter profile
    IF user_role = 'recruiter' AND company_name IS NOT NULL THEN
      INSERT INTO recruiters (user_id, company_name)
      VALUES (user_id, company_name);
      
      -- Notify admins about new recruiter
      INSERT INTO notifications (
        user_id,
        type,
        entity_id,
        entity_type,
        message
      )
      SELECT
        id,
        'new_recruiter',
        user_id,
        'users',
        'New recruiter signup: ' || user_name || ' from ' || company_name
      FROM users
      WHERE role = 'admin';
    END IF;
    
    RETURN NEXT v_user_record;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;