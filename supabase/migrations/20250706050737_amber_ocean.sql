/*
  # Add GitHub Installation ID Update Function

  1. Changes
    - Add function to update GitHub installation ID
    - Ensure proper error handling and authorization
    - Allow updating installation ID for existing developer profiles

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - Checks that the user is authorized to update the profile
*/

-- Function to update GitHub installation ID
CREATE OR REPLACE FUNCTION update_github_installation_id(
  p_user_id uuid,
  p_installation_id text
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
  is_authorized boolean;
BEGIN
  -- Check if the user is authorized to update this profile
  SELECT 
    (auth.uid() = p_user_id) OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  INTO is_authorized;
  
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Not authorized to update this profile';
  END IF;

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