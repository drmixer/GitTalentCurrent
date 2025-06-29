/*
  # Fix Developer Profile Creation Function

  1. Update the create_developer_profile function to use desired_salary instead of hourly_rate
  2. Add missing parameters for new fields
  3. Ensure compatibility with the updated schema
*/

-- Drop and recreate the create_developer_profile function with correct parameters
DROP FUNCTION IF EXISTS create_developer_profile(uuid, text, text, boolean, text[], text[], text, integer, integer);

CREATE OR REPLACE FUNCTION create_developer_profile(
  p_user_id uuid,
  p_github_handle text DEFAULT '',
  p_bio text DEFAULT '',
  p_availability boolean DEFAULT true,
  p_top_languages text[] DEFAULT '{}',
  p_linked_projects text[] DEFAULT '{}',
  p_location text DEFAULT '',
  p_experience_years integer DEFAULT 0,
  p_desired_salary integer DEFAULT 0
) RETURNS boolean AS $$
DECLARE
  user_record users%ROWTYPE;
  new_slug text;
  new_strength integer;
BEGIN
  -- Get user record
  SELECT * INTO user_record FROM users WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Generate profile slug
  new_slug := generate_profile_slug(user_record.name, p_github_handle);
  
  -- Insert developer profile
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
  ) VALUES (
    p_user_id,
    p_github_handle,
    p_bio,
    p_availability,
    p_top_languages,
    p_linked_projects,
    p_location,
    p_experience_years,
    p_desired_salary,
    new_slug,
    '{}',
    '{"email": true, "in_app": true, "assignments": true, "messages": true}'
  );
  
  -- Calculate and update profile strength
  new_strength := calculate_profile_strength(p_user_id);
  UPDATE developers SET profile_strength = new_strength WHERE user_id = p_user_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create developer profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the create_user_profile function to handle new developer fields
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  user_email text,
  user_name text,
  user_role text,
  company_name text DEFAULT ''
) RETURNS boolean AS $$
DECLARE
  new_slug text;
BEGIN
  -- Insert user profile
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    user_id,
    user_email,
    user_name,
    user_role,
    CASE 
      WHEN user_role = 'developer' THEN true
      WHEN user_role = 'admin' THEN true
      ELSE false
    END
  );
  
  -- Create role-specific profile
  IF user_role = 'developer' THEN
    -- Generate profile slug
    new_slug := generate_profile_slug(user_name, '');
    
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
    ) VALUES (
      user_id,
      '',
      '',
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
  ELSIF user_role = 'recruiter' THEN
    INSERT INTO recruiters (user_id, company_name, website, company_size, industry)
    VALUES (user_id, company_name, '', '', '');
  END IF;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;