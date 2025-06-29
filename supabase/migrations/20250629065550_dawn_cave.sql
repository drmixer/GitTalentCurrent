/*
  # Enhanced User Authentication and Profile Creation

  1. Database Structure
    - Ensures all required tables exist with proper constraints
    - Adds comprehensive RLS policies for security
    - Creates helper functions for profile management

  2. Enhanced Logging
    - Adds detailed RAISE NOTICE statements throughout the process
    - Logs all critical steps in profile creation
    - Provides clear error messages for debugging

  3. Role Validation
    - Validates user roles against allowed values
    - Defaults to 'developer' for invalid roles
    - Prevents CHECK constraint violations

  4. Error Handling
    - Comprehensive exception handling in all functions
    - Non-blocking error handling in triggers
    - Detailed warning messages for troubleshooting
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

CREATE TABLE IF NOT EXISTS recruiters (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text DEFAULT '',
  company_size text DEFAULT '',
  industry text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;

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

-- Drop and recreate recruiter policies
DROP POLICY IF EXISTS "Recruiters can manage own profile" ON recruiters;
DROP POLICY IF EXISTS "Admins can read all recruiters" ON recruiters;

-- Recruiters policies
CREATE POLICY "Recruiters can manage own profile"
  ON recruiters
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all recruiters"
  ON recruiters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Enhanced function to validate user role
CREATE OR REPLACE FUNCTION validate_user_role(input_role text)
RETURNS text AS $$
BEGIN
  -- Validate role and return safe value
  IF input_role IN ('admin', 'recruiter', 'developer') THEN
    RAISE NOTICE 'Role validation: % is valid', input_role;
    RETURN input_role;
  ELSE
    RAISE WARNING 'Role validation: % is invalid, defaulting to developer', input_role;
    RETURN 'developer';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to create user profile with comprehensive logging
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
  validated_role text;
BEGIN
  RAISE NOTICE 'Starting create_user_profile for user_id: %, email: %, name: %, role: %', 
    user_id, user_email, user_name, user_role;

  -- Validate the role
  validated_role := validate_user_role(user_role);
  
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'User profile already exists for user_id: %', user_id;
    RETURN true;
  END IF;

  RAISE NOTICE 'Creating user profile with validated role: %', validated_role;

  -- Create user profile
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    user_id,
    user_email,
    user_name,
    validated_role,
    CASE WHEN validated_role = 'developer' THEN true ELSE false END
  );

  RAISE NOTICE 'Successfully created user profile for user_id: %', user_id;

  -- Create role-specific profile
  IF validated_role = 'developer' THEN
    RAISE NOTICE 'Creating developer profile for user_id: %', user_id;
    
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
      RAISE NOTICE 'Successfully created developer profile for user_id: %', user_id;
    ELSE
      RAISE NOTICE 'Developer profile already exists for user_id: %', user_id;
    END IF;
    
  ELSIF validated_role = 'recruiter' THEN
    RAISE NOTICE 'Creating recruiter profile for user_id: % with company: %', user_id, company_name;
    
    INSERT INTO recruiters (user_id, company_name, website, company_size, industry)
    VALUES (user_id, COALESCE(NULLIF(company_name, ''), 'Company'), '', '', '');
    
    RAISE NOTICE 'Successfully created recruiter profile for user_id: %', user_id;
  END IF;

  RAISE NOTICE 'Profile creation completed successfully for user_id: %', user_id;
  RETURN true;
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE WARNING 'Unique constraint violation creating profile for user_id %: %', user_id, SQLERRM;
    RETURN false;
  WHEN check_violation THEN
    RAISE WARNING 'Check constraint violation creating profile for user_id %: %', user_id, SQLERRM;
    RETURN false;
  WHEN foreign_key_violation THEN
    RAISE WARNING 'Foreign key violation creating profile for user_id %: %', user_id, SQLERRM;
    RETURN false;
  WHEN OTHERS THEN
    RAISE WARNING 'Unexpected error creating user profile for user_id %: % (SQLSTATE: %)', user_id, SQLERRM, SQLSTATE;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to create developer profile with logging
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
  RAISE NOTICE 'Starting create_developer_profile for user_id: %', p_user_id;
  
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = p_user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'Developer profile already exists for user_id: %', p_user_id;
    RETURN true;
  END IF;

  RAISE NOTICE 'Creating new developer profile for user_id: %', p_user_id;

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

  RAISE NOTICE 'Successfully created developer profile for user_id: %', p_user_id;
  RETURN true;
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE WARNING 'Unique constraint violation creating developer profile for user_id %: %', p_user_id, SQLERRM;
    RETURN false;
  WHEN foreign_key_violation THEN
    RAISE WARNING 'Foreign key violation creating developer profile for user_id %: %', p_user_id, SQLERRM;
    RETURN false;
  WHEN OTHERS THEN
    RAISE WARNING 'Unexpected error creating developer profile for user_id %: % (SQLSTATE: %)', p_user_id, SQLERRM, SQLSTATE;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON developers TO authenticated;
GRANT ALL ON recruiters TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_developer_profile TO authenticated;

-- Enhanced trigger function with comprehensive logging and role validation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
  validated_role text;
  result boolean;
BEGIN
  RAISE NOTICE 'Trigger handle_new_user fired for user_id: %, email: %', NEW.id, NEW.email;
  RAISE NOTICE 'Raw user metadata: %', NEW.raw_user_meta_data;

  -- Extract data from metadata with detailed logging
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'developer');
  RAISE NOTICE 'Extracted role from metadata: %', user_role;
  
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );
  RAISE NOTICE 'Extracted name: %', user_name;
  
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');
  RAISE NOTICE 'Extracted company_name: %', company_name;

  -- Validate the role
  validated_role := validate_user_role(user_role);
  RAISE NOTICE 'Using validated role: %', validated_role;

  -- Use the helper function to create profile
  RAISE NOTICE 'Calling create_user_profile function...';
  SELECT create_user_profile(NEW.id, NEW.email, user_name, validated_role, company_name) INTO result;

  IF result THEN
    RAISE NOTICE 'Successfully completed profile creation for user: %', NEW.id;
  ELSE
    RAISE WARNING 'Profile creation failed for user: %', NEW.id;
  END IF;

  RAISE NOTICE 'Trigger handle_new_user completed for user_id: %', NEW.id;
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Critical error in handle_new_user trigger for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RAISE NOTICE 'Auth process will continue despite profile creation error';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_developers_updated_at ON developers;
CREATE TRIGGER update_developers_updated_at
  BEFORE UPDATE ON developers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recruiters_updated_at ON recruiters;
CREATE TRIGGER update_recruiters_updated_at
  BEFORE UPDATE ON recruiters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_developers_user_id ON developers(user_id);
CREATE INDEX IF NOT EXISTS idx_developers_availability ON developers(availability);
CREATE INDEX IF NOT EXISTS idx_developers_github_handle ON developers(github_handle);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully - enhanced logging and role validation enabled';
END $$;