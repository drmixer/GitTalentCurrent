/*
  # Ensure Admin User Exists and Can Access Dashboard

  1. Create admin user if it doesn't exist
  2. Ensure proper permissions and role assignment
  3. Verify admin can access all necessary functions
*/

-- Insert admin user if it doesn't exist
INSERT INTO users (id, email, name, role, is_approved, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@gittalent.dev',
  'Admin User',
  'admin',
  true,
  now()
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_approved = true,
  name = 'Admin User'
WHERE users.email = 'admin@gittalent.dev';

-- Also try to insert with a different UUID in case the first one conflicts
INSERT INTO users (id, email, name, role, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'admin@gittalent.dev',
  'Admin User',
  'admin',
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@gittalent.dev'
);

-- Ensure the admin user has the correct role and is approved
UPDATE users 
SET 
  role = 'admin',
  is_approved = true,
  name = 'Admin User'
WHERE email = 'admin@gittalent.dev';

-- Create a function to verify admin access
CREATE OR REPLACE FUNCTION verify_admin_access(admin_email text)
RETURNS TABLE(
  user_id uuid,
  email text,
  name text,
  role text,
  is_approved boolean,
  can_access_admin boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.is_approved,
    (u.role = 'admin' AND u.is_approved = true) as can_access_admin
  FROM users u
  WHERE u.email = admin_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION verify_admin_access TO authenticated, anon;

-- Log the admin user status
DO $$
DECLARE
  admin_count integer;
  admin_record RECORD;
BEGIN
  -- Count admin users
  SELECT COUNT(*) INTO admin_count FROM users WHERE email = 'admin@gittalent.dev';
  
  IF admin_count > 0 THEN
    -- Get admin user details
    SELECT * INTO admin_record FROM users WHERE email = 'admin@gittalent.dev';
    RAISE NOTICE 'Admin user found: ID=%, Email=%, Role=%, Approved=%', 
      admin_record.id, admin_record.email, admin_record.role, admin_record.is_approved;
  ELSE
    RAISE WARNING 'No admin user found with email admin@gittalent.dev';
  END IF;
END $$;