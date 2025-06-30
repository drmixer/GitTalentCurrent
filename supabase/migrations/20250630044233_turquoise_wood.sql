/*
  # Update Profile Strength Calculation

  1. Changes
    - Enhance the calculate_profile_strength function to include new fields
    - Add points for resume_url, notification_preferences, and public_profile_slug
    - Improve weighting of different profile components
    - Ensure profile strength accurately reflects completeness

  2. Security
    - Maintain SECURITY DEFINER to bypass RLS
    - Ensure proper error handling
*/

-- Update the calculate_profile_strength function to include new fields
CREATE OR REPLACE FUNCTION calculate_profile_strength(dev_id uuid)
RETURNS integer AS $$
DECLARE
  strength integer := 0;
  dev_record developers%ROWTYPE;
  user_record users%ROWTYPE;
  portfolio_count integer;
BEGIN
  -- Get developer and user records
  SELECT * INTO dev_record FROM developers WHERE user_id = dev_id;
  SELECT * INTO user_record FROM users WHERE id = dev_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Basic info (20 points)
  IF user_record.name IS NOT NULL AND user_record.name != '' THEN
    strength := strength + 5;
  END IF;
  
  IF user_record.email IS NOT NULL AND user_record.email != '' THEN
    strength := strength + 5;
  END IF;
  
  IF dev_record.location IS NOT NULL AND dev_record.location != '' THEN
    strength := strength + 5;
  END IF;
  
  IF dev_record.experience_years > 0 THEN
    strength := strength + 5;
  END IF;
  
  -- GitHub integration (20 points)
  IF dev_record.github_handle IS NOT NULL AND dev_record.github_handle != '' THEN
    strength := strength + 10;
  END IF;
  
  IF dev_record.bio IS NOT NULL AND dev_record.bio != '' THEN
    strength := strength + 10;
  END IF;
  
  -- Skills and projects (25 points)
  IF array_length(dev_record.top_languages, 1) >= 5 THEN
    strength := strength + 15;
  ELSIF array_length(dev_record.top_languages, 1) >= 3 THEN
    strength := strength + 10;
  ELSIF array_length(dev_record.top_languages, 1) >= 1 THEN
    strength := strength + 5;
  END IF;
  
  IF array_length(dev_record.linked_projects, 1) >= 3 THEN
    strength := strength + 10;
  ELSIF array_length(dev_record.linked_projects, 1) >= 1 THEN
    strength := strength + 5;
  END IF;
  
  -- Salary expectations (5 points)
  IF dev_record.desired_salary > 0 THEN
    strength := strength + 5;
  END IF;
  
  -- Portfolio items (10 points)
  SELECT COUNT(*) INTO portfolio_count FROM portfolio_items WHERE developer_id = dev_id;
  
  IF portfolio_count >= 3 THEN
    strength := strength + 10;
  ELSIF portfolio_count >= 1 THEN
    strength := strength + 5;
  END IF;
  
  -- Resume URL (5 points)
  IF dev_record.resume_url IS NOT NULL AND dev_record.resume_url != '' THEN
    strength := strength + 5;
  END IF;
  
  -- Public profile slug (5 points)
  IF dev_record.public_profile_slug IS NOT NULL AND dev_record.public_profile_slug != '' THEN
    strength := strength + 5;
  END IF;
  
  -- Notification preferences (5 points)
  IF dev_record.notification_preferences IS NOT NULL AND 
     dev_record.notification_preferences != '{}'::jsonb THEN
    strength := strength + 5;
  END IF;
  
  -- Skills categories (5 points)
  IF dev_record.skills_categories IS NOT NULL AND 
     dev_record.skills_categories != '{}'::jsonb THEN
    strength := strength + 5;
  END IF;
  
  RETURN LEAST(strength, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- Update the calculate_profile_strength_rpc function to use the updated calculation
CREATE OR REPLACE FUNCTION calculate_profile_strength_rpc(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  calculated_strength integer;
  is_authorized boolean;
BEGIN
  -- Check if the user is authorized to update this profile
  -- Either it's their own profile or they're an admin
  SELECT 
    (auth.uid() = p_user_id) OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  INTO is_authorized;
  
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Not authorized to update this profile';
  END IF;

  -- Calculate the profile strength
  SELECT calculate_profile_strength(p_user_id) INTO calculated_strength;
  
  -- Update the profile_strength field in the developers table
  UPDATE developers
  SET profile_strength = calculated_strength
  WHERE user_id = p_user_id;
  
  -- Return the calculated strength
  RETURN calculated_strength;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating profile strength: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_profile_strength_rpc TO authenticated;