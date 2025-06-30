/*
  # Consolidated Database Schema

  This migration consolidates all previous migrations into a single, coherent schema
  with proper RLS policies, helper functions, and triggers.

  1. Tables
     - users: Main user profiles linked to auth.users
     - developers: Developer-specific profile data
     - recruiters: Recruiter-specific profile data
     - job_roles: Job postings created by recruiters
     - assignments: Links developers to job roles
     - messages: In-app messaging between users
     - hires: Records of successful hires
     - portfolio_items: Developer portfolio showcase

  2. Security
     - Row Level Security (RLS) enabled on all tables
     - SECURITY DEFINER helper functions to prevent RLS recursion
     - Clear, non-conflicting policies for each table and operation
     - Proper permissions for authenticated users

  3. Functions
     - handle_new_user: Trigger function for auth.users to create profiles
     - create_user_profile: RPC for manual profile creation
     - create_developer_profile: RPC for developer profile creation/update
     - update_updated_at_column: For automatic timestamp updates
*/

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. Helper Functions for Triggers and RLS
--------------------------------------------------------------------------------

-- Function to automatically update 'updated_at' columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SECURITY DEFINER functions to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_recruiter()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'recruiter'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_developer()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'developer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on these helper functions to the authenticated role
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_recruiter() TO authenticated;
GRANT EXECUTE ON FUNCTION is_developer() TO authenticated;

--------------------------------------------------------------------------------
-- 2. Table Definitions
--------------------------------------------------------------------------------

-- Users table (main profiles, linked to auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'recruiter', 'developer')),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Developers table (stores developer-specific profile data)
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
  skills_categories jsonb DEFAULT '{}'::jsonb,
  profile_strength integer DEFAULT 0,
  public_profile_slug text UNIQUE,
  notification_preferences jsonb DEFAULT '{"email": true, "in_app": true, "messages": true, "assignments": true}'::jsonb,
  resume_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recruiters table (stores recruiter-specific profile data)
CREATE TABLE IF NOT EXISTS recruiters (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text DEFAULT '',
  company_size text DEFAULT '',
  industry text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Job roles table (job postings by recruiters)
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

-- Assignments table (links developers to job roles)
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

-- Messages table (in-app messaging between users)
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

-- Hires table (records successful hires)
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

-- Portfolio items table (for developers to showcase work)
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

--------------------------------------------------------------------------------
-- 3. Enable Row Level Security (RLS)
--------------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 4. RLS Policies
--------------------------------------------------------------------------------

-- Use DO blocks to safely drop and recreate policies.
-- This ensures idempotency and avoids "policy already exists" errors on re-runs.

-- Policies for 'users' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Anyone can insert user profile" ON users;
  DROP POLICY IF EXISTS "Admins can read all users" ON users;
  DROP POLICY IF EXISTS "Admins can update all users" ON users;
  DROP POLICY IF EXISTS "Recruiters can read assigned developer users" ON users;

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

  CREATE POLICY "Recruiters can read assigned developer users"
    ON users FOR SELECT
    TO authenticated
    USING (
      is_recruiter() AND
      EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.developer_id = users.id
        AND a.recruiter_id = auth.uid()
      )
    );
END $$;

-- Policies for 'developers' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Developers can manage own profile" ON developers;
  DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;
  DROP POLICY IF EXISTS "Admins can manage all developers" ON developers;

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
        SELECT 1 FROM public.assignments a
        WHERE a.developer_id = developers.user_id
        AND a.recruiter_id = auth.uid()
      )
    );

  CREATE POLICY "Admins can manage all developers"
    ON developers FOR ALL
    TO authenticated
    USING (is_admin());
END $$;

-- Policies for 'recruiters' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Recruiters can manage own profile" ON recruiters;
  DROP POLICY IF EXISTS "Admins can read all recruiters" ON recruiters;

  CREATE POLICY "Recruiters can manage own profile"
    ON recruiters FOR ALL
    TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "Admins can read all recruiters"
    ON recruiters FOR SELECT
    TO authenticated
    USING (is_admin());
END $$;

-- Policies for 'job_roles' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Recruiters can manage own job roles" ON job_roles;
  DROP POLICY IF EXISTS "Developers can read assigned job roles" ON job_roles;
  DROP POLICY IF EXISTS "Admins can read all job roles" ON job_roles;

  CREATE POLICY "Recruiters can manage own job roles"
    ON job_roles FOR ALL
    TO authenticated
    USING (auth.uid() = recruiter_id);

  CREATE POLICY "Developers can read assigned job roles"
    ON job_roles FOR SELECT
    TO authenticated
    USING (
      is_developer() AND
      EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.job_role_id = job_roles.id
        AND a.developer_id = auth.uid()
      )
    );

  CREATE POLICY "Admins can read all job roles"
    ON job_roles FOR SELECT
    TO authenticated
    USING (is_admin());
END $$;

-- Policies for 'assignments' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read own assignments" ON assignments;
  DROP POLICY IF EXISTS "Admins can manage all assignments" ON assignments;
  DROP POLICY IF EXISTS "Recruiters can update assignment status" ON assignments;

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
END $$;

-- Policies for 'messages' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read own messages" ON messages;
  DROP POLICY IF EXISTS "Users can send messages" ON messages;
  DROP POLICY IF EXISTS "Users can update own received messages" ON messages;

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
END $$;

-- Policies for 'hires' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read relevant hires" ON hires;
  DROP POLICY IF EXISTS "Recruiters can create hires" ON hires;
  DROP POLICY IF EXISTS "Admins can manage all hires" ON hires;

  CREATE POLICY "Users can read relevant hires"
    ON hires FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.assignments a
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
        SELECT 1 FROM public.assignments a
        WHERE a.id = hires.assignment_id
        AND a.recruiter_id = auth.uid()
      )
    );

  CREATE POLICY "Admins can manage all hires"
    ON hires FOR ALL
    TO authenticated
    USING (is_admin());
END $$;

-- Policies for 'portfolio_items' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can read portfolio items" ON portfolio_items;
  DROP POLICY IF EXISTS "Developers can manage own portfolio items" ON portfolio_items;

  CREATE POLICY "Public can read portfolio items"
    ON portfolio_items FOR SELECT
    TO anon, authenticated
    USING (true);

  CREATE POLICY "Developers can manage own portfolio items"
    ON portfolio_items FOR ALL
    TO authenticated
    USING (
      is_developer() AND
      EXISTS (
        SELECT 1 FROM public.developers d
        WHERE d.user_id = auth.uid() AND d.user_id = portfolio_items.developer_id
      )
    );
END $$;

--------------------------------------------------------------------------------
-- 5. Triggers for 'updated_at' columns
--------------------------------------------------------------------------------

-- Drop existing triggers and recreate them to ensure they use the latest function definition
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

--------------------------------------------------------------------------------
-- 6. User Profile Management Functions (RPCs)
--------------------------------------------------------------------------------

-- Function to handle new user signup (called by auth.users trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
  github_handle text;
  user_bio text;
  user_location text;
BEGIN
  -- Extract data from metadata, providing defaults for safety
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'developer');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');
  github_handle := COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'preferred_username', '');
  user_bio := COALESCE(NEW.raw_user_meta_data->>'bio', '');
  user_location := COALESCE(NEW.raw_user_meta_data->>'location', '');

  -- Validate role to prevent invalid values
  IF user_role NOT IN ('admin', 'recruiter', 'developer') THEN
    user_role := 'developer';
  END IF;

  -- Insert into users table with basic info
  INSERT INTO public.users (id, email, name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    CASE WHEN user_role = 'developer' THEN true ELSE false END -- Developers are auto-approved
  );

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    INSERT INTO public.developers (
      user_id,
      github_handle,
      bio,
      location
    )
    VALUES (
      NEW.id,
      github_handle,
      user_bio,
      user_location
    );
  ELSIF user_role = 'recruiter' THEN
    INSERT INTO public.recruiters (user_id, company_name)
    VALUES (
      NEW.id,
      company_name
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process.
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger and recreate to ensure it uses the latest function definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RPC function to create a user profile (can be called from frontend)
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
BEGIN
  -- Check if profile already exists in public.users
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = user_id) INTO profile_exists;

  IF profile_exists THEN
    -- If profile exists, no action needed, return true
    RETURN true;
  END IF;

  -- Validate role to prevent invalid values
  validated_role := CASE
    WHEN user_role IN ('admin', 'recruiter', 'developer') THEN user_role
    ELSE 'developer'
  END;

  -- Create user profile in public.users
  INSERT INTO public.users (id, email, name, role, is_approved)
  VALUES (
    user_id,
    user_email,
    user_name,
    validated_role,
    CASE WHEN validated_role = 'developer' THEN true ELSE false END
  );

  -- Create role-specific profile
  IF validated_role = 'developer' THEN
    INSERT INTO public.developers (user_id, github_handle, bio, availability)
    VALUES (user_id, '', '', true);
  ELSIF validated_role = 'recruiter' THEN
    INSERT INTO public.recruiters (user_id, company_name)
    VALUES (user_id, COALESCE(NULLIF(company_name, ''), 'Company'));
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile via RPC for user %: %', user_id, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to create or update a developer profile (can be called from frontend)
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
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM public.developers WHERE user_id = p_user_id) INTO profile_exists;

  IF profile_exists THEN
    -- Update existing profile
    UPDATE public.developers SET
      github_handle = COALESCE(NULLIF(p_github_handle, ''), github_handle),
      bio = COALESCE(NULLIF(p_bio, ''), bio),
      availability = p_availability,
      top_languages = CASE WHEN array_length(p_top_languages, 1) > 0 THEN p_top_languages ELSE top_languages END,
      linked_projects = CASE WHEN array_length(p_linked_projects, 1) > 0 THEN p_linked_projects ELSE linked_projects END,
      location = COALESCE(NULLIF(p_location, ''), location),
      experience_years = CASE WHEN p_experience_years > 0 THEN p_experience_years ELSE experience_years END,
      desired_salary = CASE WHEN p_desired_salary > 0 THEN p_desired_salary ELSE desired_salary END,
      updated_at = now()
    WHERE user_id = p_user_id;

    RETURN true;
  END IF;

  -- Create new developer profile
  INSERT INTO public.developers (
    user_id,
    github_handle,
    bio,
    availability,
    top_languages,
    linked_projects,
    location,
    experience_years,
    desired_salary
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
    p_desired_salary
  );

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating/updating developer profile via RPC for user %: %', p_user_id, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on RPC functions to the authenticated role
GRANT EXECUTE ON FUNCTION create_user_profile(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_developer_profile(uuid, text, text, boolean, text[], text[], text, integer, integer) TO authenticated;

--------------------------------------------------------------------------------
-- 7. Indexes for Performance
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_developers_availability ON developers(availability);
CREATE INDEX IF NOT EXISTS idx_developers_user_id ON developers(user_id);
CREATE INDEX IF NOT EXISTS idx_developers_github_handle ON developers(github_handle);
CREATE INDEX IF NOT EXISTS idx_developers_profile_strength ON developers(profile_strength);
CREATE INDEX IF NOT EXISTS idx_developers_public_profile_slug ON developers(public_profile_slug);
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

--------------------------------------------------------------------------------
-- 8. Permissions (General grants, RLS policies provide fine-grained control)
--------------------------------------------------------------------------------

-- Grant usage on public schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant all privileges on all tables in public schema to authenticated users
-- RLS policies will then restrict actual data access based on roles and ownership.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant all privileges on all sequences in public schema to authenticated users
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant all privileges on all functions in public schema to authenticated users
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

--------------------------------------------------------------------------------
-- 9. Initial Data Seeding (Optional: Admin User)
--------------------------------------------------------------------------------

-- Safely create or update a default admin user.
-- This block ensures an admin account exists for platform management.
DO $$
DECLARE
  admin_user_id uuid;
  admin_email text := 'admin@gittalent.dev';
  admin_name text := 'Admin User';
BEGIN
  -- Check if admin user already exists by email in public.users
  SELECT id INTO admin_user_id FROM public.users WHERE email = admin_email;

  IF admin_user_id IS NOT NULL THEN
    -- Update existing admin user to ensure correct role and approval status
    UPDATE public.users
    SET
      role = 'admin',
      is_approved = true,
      name = admin_name
    WHERE id = admin_user_id;
    RAISE NOTICE 'Updated existing admin user with ID: %', admin_user_id;
  ELSE
    -- If not found in public.users, check auth.users
    SELECT id INTO admin_user_id FROM auth.users WHERE email = admin_email;

    IF admin_user_id IS NULL THEN
      -- If not found in auth.users, generate a new UUID
      admin_user_id := gen_random_uuid();
      RAISE NOTICE 'Generated new UUID for admin user: %', admin_user_id;
    END IF;

    -- Insert into public.users (handle_new_user trigger won't fire for direct auth.users inserts)
    INSERT INTO public.users (id, email, name, role, is_approved, created_at)
    VALUES (
      admin_user_id,
      admin_email,
      admin_name,
      'admin',
      true,
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      is_approved = EXCLUDED.is_approved;

    RAISE NOTICE 'Created/Ensured admin user in public.users with ID: %', admin_user_id;
  END IF;
END $$;