/*
  # Complete GitTalent Database Schema

  1. New Tables
    - `users` - Main user profiles with role-based access
    - `developers` - Developer-specific profile data
    - `recruiters` - Recruiter-specific profile data  
    - `job_roles` - Job postings created by recruiters
    - `assignments` - Developer assignments to specific jobs
    - `messages` - Communication between users
    - `hires` - Successful hire records
    - `portfolio_items` - Developer portfolio showcase

  2. Security
    - Enable RLS on all tables
    - Role-based policies for data access
    - Automatic profile creation on signup

  3. Features
    - GitHub OAuth integration
    - Automatic developer approval
    - Recruiter approval workflow
    - Assignment tracking system
    - Portfolio management
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (main profiles)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'recruiter', 'developer')),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Developers table (updated schema with desired_salary)
CREATE TABLE IF NOT EXISTS developers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  github_handle text DEFAULT '',
  bio text DEFAULT '',
  availability boolean DEFAULT true,
  top_languages text[] DEFAULT '{}',
  linked_projects text[] DEFAULT '{}',
  location text DEFAULT '',
  experience_years integer DEFAULT 0,
  desired_salary integer DEFAULT 0,
  skills_categories jsonb DEFAULT '{}',
  profile_strength integer DEFAULT 0,
  public_profile_slug text UNIQUE,
  notification_preferences jsonb DEFAULT '{"email": true, "in_app": true, "assignments": true, "messages": true}',
  resume_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recruiters table
CREATE TABLE IF NOT EXISTS recruiters (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text DEFAULT '',
  company_size text DEFAULT '',
  industry text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Job roles table
CREATE TABLE IF NOT EXISTS job_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('Full-time', 'Part-time', 'Contract', 'Freelance')),
  tech_stack text[] DEFAULT '{}',
  salary_min integer DEFAULT 0,
  salary_max integer DEFAULT 0,
  experience_required text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_role_id uuid NOT NULL REFERENCES job_roles(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Shortlisted', 'Hired', 'Rejected')),
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  notes text DEFAULT ''
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_role_id uuid REFERENCES job_roles(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  subject text DEFAULT '',
  body text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz DEFAULT NULL,
  is_read boolean DEFAULT false
);

-- Hires table
CREATE TABLE IF NOT EXISTS hires (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  salary integer NOT NULL,
  hire_date timestamptz DEFAULT now(),
  start_date timestamptz DEFAULT NULL,
  notes text DEFAULT '',
  marked_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Portfolio items table
CREATE TABLE IF NOT EXISTS portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES developers(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  url text,
  image_url text,
  category text DEFAULT 'project' CHECK (category IN ('project', 'article', 'certification', 'other')),
  technologies text[] DEFAULT '{}',
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Create SECURITY DEFINER functions to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_recruiter()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'recruiter'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_developer()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'developer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_recruiter() TO authenticated;
GRANT EXECUTE ON FUNCTION is_developer() TO authenticated;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can insert user profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

DROP POLICY IF EXISTS "Developers can manage own profile" ON developers;
DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;
DROP POLICY IF EXISTS "Admins can read all developers" ON developers;
DROP POLICY IF EXISTS "Admins can manage all developers" ON developers;

DROP POLICY IF EXISTS "Recruiters can manage own profile" ON recruiters;
DROP POLICY IF EXISTS "Admins can read all recruiters" ON recruiters;

DROP POLICY IF EXISTS "Recruiters can manage own job roles" ON job_roles;
DROP POLICY IF EXISTS "Developers can read assigned job roles" ON job_roles;
DROP POLICY IF EXISTS "Admins can read all job roles" ON job_roles;

DROP POLICY IF EXISTS "Users can read own assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON assignments;
DROP POLICY IF EXISTS "Recruiters can update assignment status" ON assignments;

DROP POLICY IF EXISTS "Users can read own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update own received messages" ON messages;

DROP POLICY IF EXISTS "Users can read relevant hires" ON hires;
DROP POLICY IF EXISTS "Recruiters can create hires" ON hires;
DROP POLICY IF EXISTS "Admins can manage all hires" ON hires;

DROP POLICY IF EXISTS "Developers can manage own portfolio items" ON portfolio_items;
DROP POLICY IF EXISTS "Public can read portfolio items" ON portfolio_items;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Anyone can insert user profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Developers policies
CREATE POLICY "Developers can manage own profile"
  ON developers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Recruiters can read assigned developers"
  ON developers FOR SELECT
  TO authenticated
  USING (
    is_recruiter() AND
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.developer_id = developers.user_id 
      AND a.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all developers"
  ON developers FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage all developers"
  ON developers FOR ALL
  TO authenticated
  USING (is_admin());

-- Recruiters policies
CREATE POLICY "Recruiters can manage own profile"
  ON recruiters FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all recruiters"
  ON recruiters FOR SELECT
  TO authenticated
  USING (is_admin());

-- Job roles policies
CREATE POLICY "Recruiters can manage own job roles"
  ON job_roles FOR ALL
  TO authenticated
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Developers can read assigned job roles"
  ON job_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.job_role_id = job_roles.id 
      AND a.developer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all job roles"
  ON job_roles FOR SELECT
  TO authenticated
  USING (is_admin());

-- Assignments policies
CREATE POLICY "Users can read own assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = developer_id OR 
    auth.uid() = recruiter_id OR
    is_admin()
  );

CREATE POLICY "Admins can manage all assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (is_admin());

CREATE POLICY "Recruiters can update assignment status"
  ON assignments FOR UPDATE
  TO authenticated
  USING (auth.uid() = recruiter_id);

-- Messages policies
CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    is_admin()
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id);

-- Hires policies
CREATE POLICY "Users can read relevant hires"
  ON hires FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = hires.assignment_id 
      AND (a.developer_id = auth.uid() OR a.recruiter_id = auth.uid())
    ) OR
    is_admin()
  );

CREATE POLICY "Recruiters can create hires"
  ON hires FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = hires.assignment_id 
      AND a.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all hires"
  ON hires FOR ALL
  TO authenticated
  USING (is_admin());

-- Portfolio items policies
CREATE POLICY "Developers can manage own portfolio items"
  ON portfolio_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM developers d
      WHERE d.user_id = auth.uid() AND d.user_id = portfolio_items.developer_id
    )
  );

CREATE POLICY "Public can read portfolio items"
  ON portfolio_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique profile slug
CREATE OR REPLACE FUNCTION generate_profile_slug(user_name text, github_handle text)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Create base slug from github handle or name
  IF github_handle IS NOT NULL AND github_handle != '' THEN
    base_slug := lower(github_handle);
  ELSE
    base_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g'));
  END IF;
  
  -- Remove multiple dashes and trim
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM developers WHERE public_profile_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate profile strength
CREATE OR REPLACE FUNCTION calculate_profile_strength(dev_id uuid)
RETURNS integer AS $$
DECLARE
  strength integer := 0;
  dev_record developers%ROWTYPE;
  user_record users%ROWTYPE;
BEGIN
  -- Get developer and user records
  SELECT * INTO dev_record FROM developers WHERE user_id = dev_id;
  SELECT * INTO user_record FROM users WHERE id = dev_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Basic info (20 points)
  IF user_record.name IS NOT NULL AND user_record.name != '' THEN
    strength := strength + 5;
  END IF;
  
  IF user_record.email IS NOT NULL AND user_record.email != '' THEN
    strength := strength + 5;
  END IF;
  
  IF dev_record.location IS NOT NULL AND dev_record.location != '' THEN
    strength := strength + 5;
  END IF;
  
  IF dev_record.experience_years > 0 THEN
    strength := strength + 5;
  END IF;
  
  -- GitHub integration (25 points)
  IF dev_record.github_handle IS NOT NULL AND dev_record.github_handle != '' THEN
    strength := strength + 15;
  END IF;
  
  IF dev_record.bio IS NOT NULL AND dev_record.bio != '' THEN
    strength := strength + 10;
  END IF;
  
  -- Skills and projects (30 points)
  IF array_length(dev_record.top_languages, 1) >= 3 THEN
    strength := strength + 15;
  ELSIF array_length(dev_record.top_languages, 1) >= 1 THEN
    strength := strength + 10;
  END IF;
  
  IF array_length(dev_record.linked_projects, 1) >= 2 THEN
    strength := strength + 15;
  ELSIF array_length(dev_record.linked_projects, 1) >= 1 THEN
    strength := strength + 10;
  END IF;
  
  -- Salary expectations (10 points)
  IF dev_record.desired_salary > 0 THEN
    strength := strength + 10;
  END IF;
  
  -- Portfolio items (15 points)
  IF EXISTS (SELECT 1 FROM portfolio_items WHERE developer_id = dev_id) THEN
    strength := strength + 15;
  END IF;
  
  RETURN LEAST(strength, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- Drop existing functions to avoid parameter conflicts
DROP FUNCTION IF EXISTS create_developer_profile(uuid, text, text, boolean, text[], text[], text, integer, integer);
DROP FUNCTION IF EXISTS create_user_profile(uuid, text, text, text, text);

-- Helper functions for profile management
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  user_email text,
  user_name text,
  user_role text DEFAULT 'developer',
  company_name text DEFAULT ''
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
  validated_role text;
  new_slug text;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RETURN true;
  END IF;

  -- Validate role
  validated_role := CASE 
    WHEN user_role IN ('admin', 'recruiter', 'developer') THEN user_role 
    ELSE 'developer' 
  END;

  -- Create user profile
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    user_id,
    user_email,
    user_name,
    validated_role,
    CASE WHEN validated_role = 'developer' THEN true ELSE false END
  );

  -- Create role-specific profile
  IF validated_role = 'developer' THEN
    -- Generate profile slug
    new_slug := generate_profile_slug(user_name, '');
    
    INSERT INTO developers (
      user_id, 
      github_handle, 
      bio, 
      availability,
      public_profile_slug,
      skills_categories,
      notification_preferences
    )
    VALUES (
      user_id, 
      '', 
      '', 
      true,
      new_slug,
      '{}',
      '{"email": true, "in_app": true, "assignments": true, "messages": true}'
    );
  ELSIF validated_role = 'recruiter' THEN
    INSERT INTO recruiters (user_id, company_name)
    VALUES (user_id, COALESCE(NULLIF(company_name, ''), 'Company'));
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_developer_profile(
  p_user_id uuid,
  p_github_handle text DEFAULT '',
  p_bio text DEFAULT '',
  p_availability boolean DEFAULT true,
  p_top_languages text[] DEFAULT '{}',
  p_linked_projects text[] DEFAULT '{}',
  p_location text DEFAULT '',
  p_experience_years integer DEFAULT 0,
  p_desired_salary integer DEFAULT 0
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
  user_record users%ROWTYPE;
  new_slug text;
  new_strength integer;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = p_user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RETURN true;
  END IF;

  -- Get user record
  SELECT * INTO user_record FROM users WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Generate profile slug
  new_slug := generate_profile_slug(user_record.name, p_github_handle);

  -- Create developer profile
  INSERT INTO developers (
    user_id,
    github_handle,
    bio,
    availability,
    top_languages,
    linked_projects,
    location,
    experience_years,
    desired_salary,
    public_profile_slug,
    skills_categories,
    notification_preferences
  )
  VALUES (
    p_user_id,
    p_github_handle,
    p_bio,
    p_availability,
    p_top_languages,
    p_linked_projects,
    p_location,
    p_experience_years,
    p_desired_salary,
    new_slug,
    '{}',
    '{"email": true, "in_app": true, "assignments": true, "messages": true}'
  );

  -- Calculate and update profile strength
  new_strength := calculate_profile_strength(p_user_id);
  UPDATE developers SET profile_strength = new_strength WHERE user_id = p_user_id;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating developer profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
  validated_role text;
  result boolean;
BEGIN
  -- Extract data from metadata
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'developer');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');

  -- Validate role
  validated_role := CASE 
    WHEN user_role IN ('admin', 'recruiter', 'developer') THEN user_role 
    ELSE 'developer' 
  END;

  -- Use the helper function to create profile
  SELECT create_user_profile(NEW.id, NEW.email, user_name, validated_role, company_name) INTO result;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Drop existing triggers and recreate
DROP TRIGGER IF EXISTS update_developers_updated_at ON developers;
CREATE TRIGGER update_developers_updated_at
  BEFORE UPDATE ON developers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recruiters_updated_at ON recruiters;
CREATE TRIGGER update_recruiters_updated_at
  BEFORE UPDATE ON recruiters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_roles_updated_at ON job_roles;
CREATE TRIGGER update_job_roles_updated_at
  BEFORE UPDATE ON job_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_portfolio_items_updated_at ON portfolio_items;
CREATE TRIGGER update_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_developers_availability ON developers(availability);
CREATE INDEX IF NOT EXISTS idx_developers_user_id ON developers(user_id);
CREATE INDEX IF NOT EXISTS idx_developers_github_handle ON developers(github_handle);
CREATE INDEX IF NOT EXISTS idx_developers_profile_slug ON developers(public_profile_slug);
CREATE INDEX IF NOT EXISTS idx_developers_profile_strength ON developers(profile_strength);
CREATE INDEX IF NOT EXISTS idx_job_roles_recruiter ON job_roles(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_job_roles_active ON job_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_assignments_developer ON assignments(developer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_recruiter ON assignments(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assignments_job_role ON assignments(job_role_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_developer ON portfolio_items(developer_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_featured ON portfolio_items(featured);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_developer_profile TO authenticated;
GRANT EXECUTE ON FUNCTION generate_profile_slug TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_profile_strength TO authenticated;

-- Update existing developers with profile slugs and strength (if any exist)
DO $$
DECLARE
  dev_record RECORD;
  user_record RECORD;
  new_slug text;
  new_strength integer;
BEGIN
  FOR dev_record IN SELECT * FROM developers WHERE public_profile_slug IS NULL LOOP
    -- Get user record
    SELECT * INTO user_record FROM users WHERE id = dev_record.user_id;
    
    IF FOUND THEN
      -- Generate slug
      new_slug := generate_profile_slug(user_record.name, dev_record.github_handle);
      
      -- Calculate strength
      new_strength := calculate_profile_strength(dev_record.user_id);
      
      -- Update developer
      UPDATE developers 
      SET 
        public_profile_slug = new_slug,
        profile_strength = new_strength
      WHERE user_id = dev_record.user_id;
    END IF;
  END LOOP;
END $$;