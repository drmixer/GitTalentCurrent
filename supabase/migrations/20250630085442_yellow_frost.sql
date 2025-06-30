/*
  # Update Platform to Open-Access Model

  1. Changes
    - Update RLS policies to allow recruiters to view all developer profiles
    - Update messaging system to allow recruiters to message any developer
    - Developers can only message recruiters who have messaged them first
    - Make job listings visible to all users
    - Add is_featured field to job_roles table

  2. Security
    - Maintain RLS while allowing proper communication
    - Ensure proper access controls for profiles
*/

-- Add is_featured column to job_roles if it doesn't exist
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Create a function to determine if a user can message another user
CREATE OR REPLACE FUNCTION can_message(sender_id uuid, receiver_id uuid)
RETURNS boolean AS $$
DECLARE
  sender_role text;
  receiver_role text;
  has_prior_message boolean;
BEGIN
  -- Get roles
  SELECT role INTO sender_role FROM users WHERE id = sender_id;
  SELECT role INTO receiver_role FROM users WHERE id = receiver_id;
  
  -- Admin can message anyone
  IF sender_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Anyone can message admin
  IF receiver_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Recruiter can message any developer
  IF sender_role = 'recruiter' AND receiver_role = 'developer' THEN
    RETURN true;
  END IF;
  
  -- Developer can only message recruiters who have messaged them first
  IF sender_role = 'developer' AND receiver_role = 'recruiter' THEN
    -- Check if the recruiter has messaged this developer before
    SELECT EXISTS (
      SELECT 1 FROM messages
      WHERE sender_id = receiver_id  -- Recruiter is sender
      AND receiver_id = sender_id    -- Developer is receiver
    ) INTO has_prior_message;
    
    RETURN has_prior_message;
  END IF;
  
  -- Developer cannot message other developers
  IF sender_role = 'developer' AND receiver_role = 'developer' THEN
    RETURN false;
  END IF;
  
  -- Default: no messaging allowed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_message TO authenticated;

-- Update messaging policies
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND can_message(auth.uid(), receiver_id)
  );

-- Update RLS policies for developers table to allow recruiters to view all developer profiles
DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;
DROP POLICY IF EXISTS "Recruiters can read all developers" ON developers;

CREATE POLICY "Recruiters can read all developers"
  ON developers FOR SELECT
  TO authenticated
  USING (is_recruiter());

-- Update RLS policies for users table to allow recruiters to view all developer user profiles
DROP POLICY IF EXISTS "Recruiters can read assigned developer users" ON users;
DROP POLICY IF EXISTS "Recruiters can read all developer users" ON users;

CREATE POLICY "Recruiters can read all developer users"
  ON users FOR SELECT
  TO authenticated
  USING (
    is_recruiter() AND role = 'developer'
  );

-- Update RLS policies for job_roles table to make job listings visible to all users
DROP POLICY IF EXISTS "Developers can read assigned job roles" ON job_roles;
DROP POLICY IF EXISTS "Public can read all job roles" ON job_roles;

CREATE POLICY "Public can read all job roles"
  ON job_roles FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create a function to check if a user has permission to view a developer profile
CREATE OR REPLACE FUNCTION can_view_developer_profile(viewer_id uuid, developer_id uuid)
RETURNS boolean AS $$
DECLARE
  viewer_role text;
BEGIN
  -- Get viewer role
  SELECT role INTO viewer_role FROM users WHERE id = viewer_id;
  
  -- Admin can view any profile
  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- User can view own profile
  IF viewer_id = developer_id THEN
    RETURN true;
  END IF;
  
  -- Recruiter can view any developer profile
  IF viewer_role = 'recruiter' THEN
    RETURN true;
  END IF;
  
  -- Default: no access
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_view_developer_profile TO authenticated;