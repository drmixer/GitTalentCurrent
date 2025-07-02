/*
  # Add GitHub Installation ID to Developers Table

  1. Changes
    - Add github_installation_id column to developers table
    - This column will store the GitHub App installation ID for each developer
    - Used to authenticate API requests to GitHub using the GitHub App

  2. Security
    - Maintain existing RLS policies
    - No changes to access control
*/

-- Add github_installation_id column to developers table
ALTER TABLE developers ADD COLUMN IF NOT EXISTS github_installation_id text DEFAULT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_developers_github_installation_id ON developers(github_installation_id);

-- Update the create_developer_profile function to handle github_installation_id
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
      github_installation_id = CASE WHEN p_github_installation_id IS NOT NULL THEN p_github_installation_id ELSE github_installation_id END,
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
    RAISE WARNING 'Error creating/updating developer profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_developer_profile(uuid, text, text, boolean, text[], text[], text, integer, integer, text, text) TO authenticated;