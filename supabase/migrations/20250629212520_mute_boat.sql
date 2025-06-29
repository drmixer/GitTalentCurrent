/*
  # Fix Recruiter Access to Developer Profiles

  1. Security Updates
    - Add policy to allow recruiters to view developer profiles they're assigned to
    - Fix RLS policies for proper data access between recruiters and developers
    - Ensure recruiters can view developer user data

  2. Changes
    - Add policy for recruiters to read assigned developer users
    - Ensure proper access control while maintaining security
*/

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