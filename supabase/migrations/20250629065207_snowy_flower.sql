/*
  # Fix Authentication Flow

  1. Enhanced Error Handling
    - Improve RLS policies to handle edge cases
    - Add better error handling in functions
    - Ensure proper permissions

  2. Profile Creation
    - Enhance user profile creation function
    - Add fallback mechanisms
    - Improve GitHub user handling

  3. Security
    - Maintain RLS while allowing profile creation
    - Ensure proper access controls
*/

-- Ensure all required tables exist
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

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies with better error handling
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can insert user profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

-- Users policies with improved error handling
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

-- Drop and recreate developer policies
DROP POLICY IF EXISTS "Dev can view own profile" ON developers;
DROP POLICY IF EXISTS "Dev can create own profile" ON developers;
DROP POLICY IF EXISTS "Dev can update own profile" ON developers;
DROP POLICY IF EXISTS "Dev can delete own profile" ON developers;
DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;
DROP POLICY IF EXISTS "Admins can manage all developers" ON developers;

-- Developers policies
CREATE POLICY "Dev can view own profile"
  ON developers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Dev can create own profile"
  ON developers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Dev can update own profile"
  ON developers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Dev can delete own profile"
  ON developers
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all developers"
  ON developers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Enhanced function to create user profile with better error handling
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
  dev_profile_exists boolean;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'User profile already exists for user_id: %', user_id;
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

  RAISE NOTICE 'Created user profile for user_id: %', user_id;

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    -- Check if developer profile already exists
    SELECT EXISTS(SELECT 1 FROM developers WHERE developers.user_id = create_user_profile.user_id) INTO dev_profile_exists;
    
    IF NOT dev_profile_exists THEN
      INSERT INTO developers (
        user_id, 
        github_handle, 
        bio, 
        availability,
        top_languages,
        linked_projects,
        location,
        experience_years,
        hourly_rate
      )
      VALUES (
        user_id, 
        '', 
        '', 
        true,
        '{}',
        '{}',
        '',
        0,
        0
      );
      RAISE NOTICE 'Created developer profile for user_id: %', user_id;
    END IF;
  ELSIF user_role = 'recruiter' THEN
    INSERT INTO recruiters (user_id, company_name, website, company_size, industry)
    VALUES (user_id, COALESCE(company_name, 'Company'), '', '', '');
    RAISE NOTICE 'Created recruiter profile for user_id: %', user_id;
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile for user_id %: %', user_id, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to create developer profile
CREATE OR REPLACE FUNCTION create_developer_profile(
  p_user_id uuid,
  p_github_handle text DEFAULT '',
  p_bio text DEFAULT '',
  p_availability boolean DEFAULT true,
  p_top_languages text[] DEFAULT '{}',
  p_linked_projects text[] DEFAULT '{}',
  p_location text DEFAULT '',
  p_experience_years integer DEFAULT 0,
  p_hourly_rate integer DEFAULT 0
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = p_user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'Developer profile already exists for user_id: %', p_user_id;
    RETURN true;
  END IF;

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
    hourly_rate
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
    p_hourly_rate
  );

  RAISE NOTICE 'Created developer profile for user_id: %', p_user_id;
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating developer profile for user_id %: %', p_user_id, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON developers TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_developer_profile TO authenticated;

-- Enhanced trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
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

  -- Use the helper function to create profile
  SELECT create_user_profile(NEW.id, NEW.email, user_name, user_role, company_name) INTO result;

  IF result THEN
    RAISE NOTICE 'Successfully created profile for user: %', NEW.id;
  ELSE
    RAISE WARNING 'Failed to create profile for user: %', NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error in handle_new_user trigger for user %: %', NEW.id, SQLERRM;
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
CREATE INDEX IF NOT EXISTS idx_developers_user_id ON developers(user_id);
CREATE INDEX IF NOT EXISTS idx_developers_availability ON developers(availability);
CREATE INDEX IF NOT EXISTS idx_developers_github_handle ON developers(github_handle);