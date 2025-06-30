/*
  # Fix Messaging System and Developer Profile Access

  1. Changes
    - Add function to determine if a user can message another user
    - Fix RLS policies for messaging between different user roles
    - Ensure recruiters can view developer profiles they're assigned to
    - Add policies for developers to message recruiters and admins

  2. Security
    - Maintain RLS while allowing proper communication
    - Ensure proper access controls for profiles
*/

-- Create a function to determine if a user can message another user
CREATE OR REPLACE FUNCTION can_message(sender_id uuid, receiver_id uuid)
RETURNS boolean AS $$
DECLARE
  sender_role text;
  receiver_role text;
  has_assignment boolean;
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
  
  -- Recruiter messaging developer or developer messaging recruiter
  IF (sender_role = 'recruiter' AND receiver_role = 'developer') OR 
     (sender_role = 'developer' AND receiver_role = 'recruiter') THEN
    -- Check if there's an assignment between them
    SELECT EXISTS (
      SELECT 1 FROM assignments 
      WHERE (developer_id = CASE WHEN sender_role = 'developer' THEN sender_id ELSE receiver_id END)
      AND (recruiter_id = CASE WHEN sender_role = 'recruiter' THEN sender_id ELSE receiver_id END)
    ) INTO has_assignment;
    
    -- If there's an assignment, check if developer is initiating contact
    IF has_assignment AND sender_role = 'developer' THEN
      -- Developer can only message recruiter if recruiter has messaged first
      SELECT EXISTS (
        SELECT 1 FROM messages
        WHERE sender_id = receiver_id  -- Recruiter is sender
        AND receiver_id = sender_id    -- Developer is receiver
      ) INTO has_prior_message;
      
      RETURN has_prior_message;
    END IF;
    
    -- Recruiter can always message assigned developer
    RETURN has_assignment;
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

-- Ensure recruiters can view developer profiles they're assigned to
DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;

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

-- Also ensure recruiters can read user data for assigned developers
DROP POLICY IF EXISTS "Recruiters can read assigned developer users" ON users;

CREATE POLICY "Recruiters can read assigned developer users"
  ON users FOR SELECT
  TO authenticated
  USING (
    is_recruiter() AND
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.developer_id = users.id 
      AND a.recruiter_id = auth.uid()
    )
  );

-- Create a function to check if a user has permission to view a developer profile
CREATE OR REPLACE FUNCTION can_view_developer_profile(viewer_id uuid, developer_id uuid)
RETURNS boolean AS $$
DECLARE
  viewer_role text;
  has_contact boolean;
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
  
  -- Recruiter can view assigned developers
  IF viewer_role = 'recruiter' THEN
    RETURN EXISTS (
      SELECT 1 FROM assignments 
      WHERE recruiter_id = viewer_id AND developer_id = developer_id
    );
  END IF;
  
  -- Default: no access
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_view_developer_profile TO authenticated;