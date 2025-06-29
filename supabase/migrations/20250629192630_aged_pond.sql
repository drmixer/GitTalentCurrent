/*
  # Enhanced Trigger Logging for User Creation

  1. Changes
    - Add detailed logging to handle_new_user trigger function
    - Log each step of the user and profile creation process
    - Provide clear visibility into role determination and approval status
    - Help diagnose issues with recruiter approval workflow
*/

-- Drop existing trigger and function to recreate with enhanced logging
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate handle_new_user with detailed logging
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
  is_approved_status boolean;
BEGIN
  RAISE NOTICE 'handle_new_user trigger fired for new user: % (email: %)', NEW.id, NEW.email;
  RAISE NOTICE 'Raw user metadata: %', NEW.raw_user_meta_data;

  -- Extract data from metadata with detailed logging
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'developer');
  RAISE NOTICE 'Extracted user_role: %', user_role;

  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );
  RAISE NOTICE 'Extracted user_name: %', user_name;

  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');
  RAISE NOTICE 'Extracted company_name: %', company_name;

  -- Validate role
  IF user_role NOT IN ('admin', 'recruiter', 'developer') THEN
    RAISE WARNING 'Invalid user_role "%" detected, defaulting to "developer".', user_role;
    user_role := 'developer';
  END IF;

  -- Determine is_approved status
  is_approved_status := (user_role = 'developer' OR user_role = 'admin');
  RAISE NOTICE 'Determined is_approved_status: % for role: %', is_approved_status, user_role;

  -- Insert into users table with basic info
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    is_approved_status
  );
  RAISE NOTICE 'Inserted into users table for user_id: % with role: % and is_approved: %', 
    NEW.id, user_role, is_approved_status;

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    RAISE NOTICE 'Creating developer profile for user_id: %', NEW.id;
    
    -- Generate profile slug
    DECLARE
      new_slug text;
    BEGIN
      new_slug := generate_profile_slug(user_name, COALESCE(NEW.raw_user_meta_data->>'user_name', ''));
      
      INSERT INTO developers (
        user_id,
        github_handle,
        bio,
        availability,
        top_languages,
        linked_projects,
        location,
        experience_years,
        desired_salary,
        public_profile_slug,
        skills_categories,
        notification_preferences
      )
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'user_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'bio', ''),
        true,
        '{}',
        '{}',
        '',
        0,
        0,
        new_slug,
        '{}',
        '{"email": true, "in_app": true, "assignments": true, "messages": true}'
      );
      
      RAISE NOTICE 'Successfully created developer profile for user_id: % with github_handle: %', 
        NEW.id, COALESCE(NEW.raw_user_meta_data->>'user_name', '');
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error creating developer profile: %', SQLERRM;
    END;
    
  ELSIF user_role = 'recruiter' THEN
    RAISE NOTICE 'Creating recruiter profile for user_id: % with company_name: %', NEW.id, company_name;
    
    BEGIN
      INSERT INTO recruiters (
        user_id,
        company_name,
        website,
        company_size,
        industry
      )
      VALUES (
        NEW.id,
        company_name,
        '',
        '',
        ''
      );
      
      RAISE NOTICE 'Successfully created recruiter profile for user_id: % with company_name: %', 
        NEW.id, company_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error creating recruiter profile: %', SQLERRM;
    END;
  END IF;

  RAISE NOTICE 'handle_new_user trigger completed successfully for user_id: %', NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Critical error in handle_new_user trigger for user %: % (SQLSTATE: %)', 
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create a function to check pending recruiters
CREATE OR REPLACE FUNCTION check_pending_recruiters()
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  company_name text,
  created_at timestamptz
) AS $$
BEGIN
  RAISE NOTICE 'Checking for pending recruiters...';
  
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
    
  RAISE NOTICE 'Pending recruiters query completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_pending_recruiters TO authenticated;

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
  
  IF pending_count = 0 THEN
    RAISE NOTICE 'No pending recruiters found in the database';
  ELSE
    RAISE NOTICE 'Found % pending recruiters', pending_count;
  END IF;
END $$;