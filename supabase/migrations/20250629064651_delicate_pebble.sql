/*
  # Fix Developer Onboarding and RLS Policies

  1. New Tables
    - Ensure developers table has proper structure
    - Add RLS policies for safe profile access
  
  2. Security
    - Enable RLS on developers table
    - Add policies for developers to view and create their own profiles
    - Add policies for recruiters and admins
  
  3. Functions
    - Create helper function for safe profile creation
    - Improve error handling in triggers
*/

-- Ensure developers table exists with all required columns
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

-- Enable RLS on developers table
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Dev can view own profile" ON developers;
DROP POLICY IF EXISTS "Dev can create own profile" ON developers;
DROP POLICY IF EXISTS "Dev can update own profile" ON developers;
DROP POLICY IF EXISTS "Developers can manage own profile" ON developers;
DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;
DROP POLICY IF EXISTS "Admins can read all developers" ON developers;

-- Create comprehensive RLS policies for developers table
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

CREATE POLICY "Recruiters can read assigned developers"
  ON developers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'recruiter'
    ) AND
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.developer_id = developers.user_id 
      AND a.recruiter_id = auth.uid()
    )
  );

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

-- Create function to safely check if developer profile exists
CREATE OR REPLACE FUNCTION developer_profile_exists(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM developers WHERE developers.user_id = $1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely create developer profile
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
BEGIN
  -- Check if profile already exists
  IF developer_profile_exists(p_user_id) THEN
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

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating developer profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION developer_profile_exists TO authenticated;
GRANT EXECUTE ON FUNCTION create_developer_profile TO authenticated;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger for developers
DROP TRIGGER IF EXISTS update_developers_updated_at ON developers;
CREATE TRIGGER update_developers_updated_at
  BEFORE UPDATE ON developers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_developers_user_id ON developers(user_id);
CREATE INDEX IF NOT EXISTS idx_developers_availability ON developers(availability);
CREATE INDEX IF NOT EXISTS idx_developers_github_handle ON developers(github_handle);