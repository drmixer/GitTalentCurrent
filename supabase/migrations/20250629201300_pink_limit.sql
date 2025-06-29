/*
  # Fix Recruiter Role Assignment and Approval

  1. Changes
    - Add a function to properly extract role from user metadata
    - Ensure recruiter role is preserved during signup
    - Fix approval status for recruiters
    - Add logging for debugging role assignment issues
*/

-- Create a function to properly extract role from user metadata
CREATE OR REPLACE FUNCTION extract_user_role(metadata jsonb)
RETURNS text AS $$
DECLARE
  role_value text;
BEGIN
  -- Try to get role from different possible locations in metadata
  role_value := metadata->>'role';
  
  -- Validate and return the role
  IF role_value IN ('admin', 'recruiter', 'developer') THEN
    RETURN role_value;
  ELSE
    -- Default to developer for GitHub users or if role is invalid
    RETURN 'developer';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION extract_user_role TO authenticated;

-- Enhance the handle_new_user trigger function to better handle roles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
BEGIN
  RAISE NOTICE 'Processing new user signup: % (email: %)', NEW.id, NEW.email;
  RAISE NOTICE 'User metadata: %', NEW.raw_user_meta_data;
  
  -- Extract data from metadata with better role handling
  user_role := extract_user_role(NEW.raw_user_meta_data);
  RAISE NOTICE 'Extracted role: %', user_role;
  
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );
  
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');
  
  -- Determine approval status based on role
  DECLARE
    is_approved_status boolean;
  BEGIN
    is_approved_status := (user_role = 'developer' OR user_role = 'admin');
    RAISE NOTICE 'Setting approval status: % for role: %', is_approved_status, user_role;
    
    -- Insert into users table with proper role and approval status
    INSERT INTO users (id, email, name, role, is_approved)
    VALUES (
      NEW.id,
      NEW.email,
      user_name,
      user_role,
      is_approved_status
    );
    
    RAISE NOTICE 'Created user profile with role: % and approval status: %', 
      user_role, is_approved_status;
  END;

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    RAISE NOTICE 'Creating developer profile for: %', NEW.id;
    
    INSERT INTO developers (user_id, github_handle, bio)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'user_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'bio', '')
    );
    
    RAISE NOTICE 'Developer profile created successfully';
  ELSIF user_role = 'recruiter' THEN
    RAISE NOTICE 'Creating recruiter profile for: % with company: %', NEW.id, company_name;
    
    INSERT INTO recruiters (user_id, company_name)
    VALUES (
      NEW.id,
      company_name
    );
    
    RAISE NOTICE 'Recruiter profile created successfully';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update the create_user_profile function to better handle roles
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
  validated_role text;
  is_approved_status boolean;
BEGIN
  RAISE NOTICE 'Creating user profile for: % with role: %', user_id, user_role;
  
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'User profile already exists for: %', user_id;
    RETURN true;
  END IF;

  -- Validate role
  validated_role := CASE 
    WHEN user_role IN ('admin', 'recruiter', 'developer') THEN user_role 
    ELSE 'developer' 
  END;
  
  -- Determine approval status
  is_approved_status := (validated_role = 'developer' OR validated_role = 'admin');
  
  RAISE NOTICE 'Creating user with role: % and approval status: %', 
    validated_role, is_approved_status;

  -- Create user profile
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    user_id,
    user_email,
    user_name,
    validated_role,
    is_approved_status
  );

  -- Create role-specific profile
  IF validated_role = 'developer' THEN
    RAISE NOTICE 'Creating developer profile for: %', user_id;
    
    INSERT INTO developers (user_id, github_handle, bio, availability)
    VALUES (user_id, '', '', true);
    
    RAISE NOTICE 'Developer profile created successfully';
  ELSIF validated_role = 'recruiter' THEN
    RAISE NOTICE 'Creating recruiter profile for: % with company: %', user_id, company_name;
    
    INSERT INTO recruiters (user_id, company_name)
    VALUES (user_id, COALESCE(NULLIF(company_name, ''), 'Company'));
    
    RAISE NOTICE 'Recruiter profile created successfully';
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check pending recruiters
CREATE OR REPLACE FUNCTION get_pending_recruiters()
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  company_name text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.name,
    r.company_name,
    u.created_at
  FROM 
    users u
    JOIN recruiters r ON u.id = r.user_id
  WHERE 
    u.role = 'recruiter' 
    AND u.is_approved = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_recruiters TO authenticated;

-- Log any existing pending recruiters
DO $$
DECLARE
  pending_count integer;
BEGIN
  SELECT COUNT(*) INTO pending_count 
  FROM users u
  JOIN recruiters r ON u.id = r.user_id
  WHERE u.role = 'recruiter' AND u.is_approved = false;
  
  RAISE NOTICE 'Current pending recruiters count: %', pending_count;
END $$;