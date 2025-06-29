/*
  # Fix Developer Profile Access for Recruiters

  1. Security Updates
    - Update RLS policy to allow recruiters to read developer profiles they have assignments with
    - Ensure proper access control while maintaining security

  2. Changes
    - Modify the "Recruiters can read assigned developers" policy to be more permissive
    - Add additional policy for user data access
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