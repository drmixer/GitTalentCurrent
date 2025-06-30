/*
  # Update Logo URL in Database

  1. Changes
    - Add profile_pic_url column to developers table if it doesn't exist
    - Ensure proper handling of avatar_url from OAuth providers
*/

-- Add profile_pic_url column to developers table if it doesn't exist
ALTER TABLE developers ADD COLUMN IF NOT EXISTS profile_pic_url text DEFAULT NULL;

-- Update the handle_new_user function to capture profile_pic_url from GitHub metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
  github_handle text;
  user_bio text;
  user_location text;
  avatar_url text;
BEGIN
  -- Extract data from metadata
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'developer');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');
  github_handle := COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'preferred_username', '');
  user_bio := COALESCE(NEW.raw_user_meta_data->>'bio', '');
  user_location := COALESCE(NEW.raw_user_meta_data->>'location', '');
  avatar_url := COALESCE(NEW.raw_user_meta_data->>'avatar_url', '');

  -- Validate role
  IF user_role NOT IN ('admin', 'recruiter', 'developer') THEN
    user_role := 'developer';
  END IF;

  -- Insert into users table with basic info
  INSERT INTO public.users (id, email, name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    CASE WHEN user_role = 'developer' THEN true ELSE false END -- Developers are auto-approved
  );

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    INSERT INTO public.developers (
      user_id,
      github_handle,
      bio,
      location,
      profile_pic_url
    )
    VALUES (
      NEW.id,
      github_handle,
      user_bio,
      user_location,
      avatar_url
    );
  ELSIF user_role = 'recruiter' THEN
    INSERT INTO public.recruiters (user_id, company_name)
    VALUES (
      NEW.id,
      company_name
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process.
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger and recreate to ensure it uses the latest function definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update the create_developer_profile function to handle profile_pic_url
CREATE OR REPLACE FUNCTION create_developer_profile(
  p_user_id uuid,
  p_github_handle text DEFAULT '',
  p_bio text DEFAULT '',
  p_availability boolean DEFAULT true,
  p_top_languages text[] DEFAULT '{}',
  p_linked_projects text[] DEFAULT '{}',
  p_location text DEFAULT '',
  p_experience_years integer DEFAULT 0,
  p_desired_salary integer DEFAULT 0,
  p_profile_pic_url text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = p_user_id) INTO profile_exists;
  
  IF profile_exists THEN
    -- Update existing profile
    UPDATE developers SET
      github_handle = COALESCE(NULLIF(p_github_handle, ''), github_handle),
      bio = COALESCE(NULLIF(p_bio, ''), bio),
      availability = p_availability,
      top_languages = CASE WHEN array_length(p_top_languages, 1) > 0 THEN p_top_languages ELSE top_languages END,
      linked_projects = CASE WHEN array_length(p_linked_projects, 1) > 0 THEN p_linked_projects ELSE linked_projects END,
      location = COALESCE(NULLIF(p_location, ''), location),
      experience_years = CASE WHEN p_experience_years > 0 THEN p_experience_years ELSE experience_years END,
      desired_salary = CASE WHEN p_desired_salary > 0 THEN p_desired_salary ELSE desired_salary END,
      profile_pic_url = CASE WHEN p_profile_pic_url IS NOT NULL THEN p_profile_pic_url ELSE profile_pic_url END,
      updated_at = now()
    WHERE user_id = p_user_id;
    
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
    desired_salary,
    profile_pic_url
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
    p_desired_salary,
    p_profile_pic_url
  );

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating/updating developer profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_developer_profile(uuid, text, text, boolean, text[], text[], text, integer, integer, text) TO authenticated;