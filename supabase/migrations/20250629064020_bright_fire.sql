/*
  # Fix Database Issues and User Profile Creation

  1. Check and fix table structure
  2. Ensure proper permissions
  3. Add better error handling
  4. Create missing user profile if needed
*/

-- First, let's ensure all tables exist with proper structure
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'recruiter', 'developer')),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS developers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  github_handle text DEFAULT '',
  bio text DEFAULT '',
  availability boolean DEFAULT true,
  top_languages text[] DEFAULT '{}',
  linked_projects text[] DEFAULT '{}',
  location text DEFAULT '',
  experience_years integer DEFAULT 0,
  hourly_rate integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recruiters (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text DEFAULT '',
  company_size text DEFAULT '',
  industry text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can insert user profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

DROP POLICY IF EXISTS "Developers can manage own profile" ON developers;
DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;
DROP POLICY IF EXISTS "Admins can read all developers" ON developers;

DROP POLICY IF EXISTS "Recruiters can manage own profile" ON recruiters;
DROP POLICY IF EXISTS "Admins can read all recruiters" ON recruiters;

-- Recreate policies with better error handling
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
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Developers policies
CREATE POLICY "Developers can manage own profile"
  ON developers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all developers"
  ON developers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Recruiters policies
CREATE POLICY "Recruiters can manage own profile"
  ON recruiters FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all recruiters"
  ON recruiters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Grant proper permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON developers TO authenticated;
GRANT ALL ON recruiters TO authenticated;

-- Create a function to manually create user profile
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
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RETURN true;
  END IF;

  -- Create user profile
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    user_id,
    user_email,
    user_name,
    user_role,
    CASE WHEN user_role = 'developer' THEN true ELSE false END
  );

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    INSERT INTO developers (user_id, github_handle, bio, availability)
    VALUES (user_id, '', '', true);
  ELSIF user_role = 'recruiter' THEN
    INSERT INTO recruiters (user_id, company_name)
    VALUES (user_id, COALESCE(company_name, 'Company'));
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;

-- Improved trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
BEGIN
  -- Extract data from metadata
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'developer');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');

  -- Use the helper function to create profile
  PERFORM create_user_profile(NEW.id, NEW.email, user_name, user_role, company_name);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_developers_availability ON developers(availability);