/*
  # Fix GitHub Authentication and Installation ID Handling

  1. Changes
    - Add function to update GitHub installation ID
    - Improve error handling in developer profile creation
    - Add function to check if GitHub App is connected

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access controls
*/

-- Function to update GitHub installation ID
CREATE OR REPLACE FUNCTION update_github_installation_id(
  p_user_id uuid,
  p_installation_id text
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
BEGIN
  -- Check if developer profile exists
  SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = p_user_id) INTO profile_exists;
  
  IF NOT profile_exists THEN
    RAISE EXCEPTION 'Developer profile not found for user_id: %', p_user_id;
  END IF;

  -- Update the installation ID
  UPDATE developers
  SET 
    github_installation_id = p_installation_id,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating GitHub installation ID: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_github_installation_id TO authenticated;

-- Function to check if GitHub App is connected
CREATE OR REPLACE FUNCTION is_github_app_connected(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  has_installation_id boolean;
BEGIN
  SELECT 
    github_installation_id IS NOT NULL AND github_installation_id != ''
  INTO has_installation_id
  FROM developers
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(has_installation_id, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_github_app_connected TO authenticated;

-- Improve the create_developer_profile function to better handle GitHub installation ID
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
  p_profile_pic_url text DEFAULT NULL,
  p_github_installation_id text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
  user_exists boolean;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User does not exist: %', p_user_id;
  END IF;

  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = p_user_id) INTO profile_exists;
  
  IF profile_exists THEN
    -- Update existing profile
    UPDATE developers SET
      github_handle = CASE WHEN p_github_handle != '' THEN p_github_handle ELSE github_handle END,
      bio = CASE WHEN p_bio != '' THEN p_bio ELSE bio END,
      availability = p_availability,
      top_languages = CASE WHEN array_length(p_top_languages, 1) > 0 THEN p_top_languages ELSE top_languages END,
      linked_projects = CASE WHEN array_length(p_linked_projects, 1) > 0 THEN p_linked_projects ELSE linked_projects END,
      location = CASE WHEN p_location != '' THEN p_location ELSE location END,
      experience_years = CASE WHEN p_experience_years > 0 THEN p_experience_years ELSE experience_years END,
      desired_salary = CASE WHEN p_desired_salary > 0 THEN p_desired_salary ELSE desired_salary END,
      profile_pic_url = CASE WHEN p_profile_pic_url IS NOT NULL THEN p_profile_pic_url ELSE profile_pic_url END,
      github_installation_id = CASE WHEN p_github_installation_id IS NOT NULL AND p_github_installation_id != '' 
                                   THEN p_github_installation_id 
                                   ELSE github_installation_id END,
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
    profile_pic_url,
    github_installation_id
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
    p_profile_pic_url,
    p_github_installation_id
  );

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating/updating developer profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_developer_profile(uuid, text, text, boolean, text[], text[], text, integer, integer, text, text) TO authenticated;