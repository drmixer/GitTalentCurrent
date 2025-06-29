/*
  # Fix RLS Recursion with SECURITY DEFINER Functions

  1. Problem
    - RLS policies on `users` table contain self-referential subqueries
    - This causes "infinite recursion detected in policy" errors
    - Prevents user profile creation and fetching

  2. Solution
    - Create `SECURITY DEFINER` functions to check user roles
    - These functions bypass RLS when querying the users table
    - Update RLS policies to use these functions instead of direct subqueries

  3. Changes
    - Create `is_admin()` and `is_recruiter()` functions
    - Update all RLS policies to use these functions
    - Remove self-referential subqueries from policies
*/

-- Create SECURITY DEFINER functions to check user roles
-- These functions bypass RLS and can safely query the users table
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_recruiter()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'recruiter'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_developer()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'developer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_recruiter() TO authenticated;
GRANT EXECUTE ON FUNCTION is_developer() TO authenticated;

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Recruiters can read assigned developers" ON developers;
DROP POLICY IF EXISTS "Admins can read all developers" ON developers;
DROP POLICY IF EXISTS "Admins can manage all developers" ON developers;
DROP POLICY IF EXISTS "Admins can read all recruiters" ON recruiters;

-- Recreate users policies using SECURITY DEFINER functions
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Recreate developers policies using SECURITY DEFINER functions
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

CREATE POLICY "Admins can read all developers"
  ON developers FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage all developers"
  ON developers FOR ALL
  TO authenticated
  USING (is_admin());

-- Recreate recruiters policies using SECURITY DEFINER functions
CREATE POLICY "Admins can read all recruiters"
  ON recruiters FOR SELECT
  TO authenticated
  USING (is_admin());

-- Update other tables that might have similar issues
-- Ensure job_roles table exists and has proper policies
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

ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate job_roles policies
DROP POLICY IF EXISTS "Admins can read all job roles" ON job_roles;
CREATE POLICY "Admins can read all job roles"
  ON job_roles FOR SELECT
  TO authenticated
  USING (is_admin());

-- Ensure assignments table exists and has proper policies
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

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Drop and recreate assignments policies
DROP POLICY IF EXISTS "Users can read own assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON assignments;

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

-- Ensure messages table exists and has proper policies
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

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop and recreate messages policies
DROP POLICY IF EXISTS "Users can read own messages" ON messages;

CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    is_admin()
  );

-- Ensure hires table exists and has proper policies
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

ALTER TABLE hires ENABLE ROW LEVEL SECURITY;

-- Drop and recreate hires policies
DROP POLICY IF EXISTS "Users can read relevant hires" ON hires;
DROP POLICY IF EXISTS "Admins can manage all hires" ON hires;

CREATE POLICY "Users can read relevant hires"
  ON hires FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = hires.assignment_id 
      AND (a.developer_id = auth.uid() OR a.recruiter_id = auth.uid())
    ) OR
    is_admin()
  );

CREATE POLICY "Admins can manage all hires"
  ON hires FOR ALL
  TO authenticated
  USING (is_admin());

-- Create a comprehensive function to safely get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = user_id;
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'RLS recursion fix completed successfully';
  RAISE NOTICE 'Created SECURITY DEFINER functions: is_admin(), is_recruiter(), is_developer(), get_user_role()';
  RAISE NOTICE 'Updated all RLS policies to use these functions instead of self-referential subqueries';
END $$;