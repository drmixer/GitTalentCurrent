/*
  # Fix Messaging Permissions

  1. Changes
    - Add policies to ensure developers can message recruiters
    - Add policies to ensure recruiters can message developers
    - Add policies to ensure admins can message everyone
    - Fix RLS policies for viewing developer profiles
*/

-- Drop existing policies for messaging
DROP POLICY IF EXISTS "Users can read own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update own received messages" ON messages;

-- Recreate messaging policies with better permissions
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
  WITH CHECK (
    -- User can only send messages as themselves
    auth.uid() = sender_id AND
    (
      -- Admins can message anyone
      is_admin() OR
      
      -- Developers can message recruiters who have assigned them
      (
        EXISTS (
          SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer'
        ) AND
        EXISTS (
          SELECT 1 FROM users WHERE id = receiver_id AND role = 'recruiter'
        ) AND
        EXISTS (
          SELECT 1 FROM assignments 
          WHERE developer_id = auth.uid() AND recruiter_id = receiver_id
        )
      ) OR
      
      -- Developers can message admins
      (
        EXISTS (
          SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer'
        ) AND
        EXISTS (
          SELECT 1 FROM users WHERE id = receiver_id AND role = 'admin'
        )
      ) OR
      
      -- Recruiters can message developers who are assigned to them
      (
        EXISTS (
          SELECT 1 FROM users WHERE id = auth.uid() AND role = 'recruiter'
        ) AND
        EXISTS (
          SELECT 1 FROM users WHERE id = receiver_id AND role = 'developer'
        ) AND
        EXISTS (
          SELECT 1 FROM assignments 
          WHERE recruiter_id = auth.uid() AND developer_id = receiver_id
        )
      ) OR
      
      -- Recruiters can message admins
      (
        EXISTS (
          SELECT 1 FROM users WHERE id = auth.uid() AND role = 'recruiter'
        ) AND
        EXISTS (
          SELECT 1 FROM users WHERE id = receiver_id AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Users can update own received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id);

-- Drop and recreate the policy for recruiters reading developers
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
    role = 'developer' AND
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.developer_id = users.id 
      AND a.recruiter_id = auth.uid()
    )
  );

-- Create a function to check if a user can message another user
CREATE OR REPLACE FUNCTION can_message(sender_id uuid, receiver_id uuid)
RETURNS boolean AS $$
DECLARE
  sender_role text;
  receiver_role text;
  has_assignment boolean;
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
  
  -- Check if there's an assignment between developer and recruiter
  IF (sender_role = 'developer' AND receiver_role = 'recruiter') OR 
     (sender_role = 'recruiter' AND receiver_role = 'developer') THEN
    
    SELECT EXISTS (
      SELECT 1 FROM assignments 
      WHERE 
        (developer_id = sender_id AND recruiter_id = receiver_id) OR
        (developer_id = receiver_id AND recruiter_id = sender_id)
    ) INTO has_assignment;
    
    RETURN has_assignment;
  END IF;
  
  -- Default: no messaging allowed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_message TO authenticated;