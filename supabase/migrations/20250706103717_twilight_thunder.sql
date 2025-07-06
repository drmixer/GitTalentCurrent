/*
  # Fix User Profile Creation RPC Function

  1. Changes
    - Update create_user_profile RPC function to handle both user and developer profile creation
    - Add better error handling and logging
    - Ensure proper handling of GitHub data
    - Set default values for new fields

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - Proper validation of input parameters
*/

-- Function to create a user profile via RPC
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
  dev_profile_exists boolean;
  validated_role text;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user_id) INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'User profile already exists for user_id: %', user_id;
    
    -- Check if developer profile exists for developers
    IF user_role = 'developer' THEN
      SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = user_id) INTO dev_profile_exists;
      
      IF NOT dev_profile_exists THEN
        -- Create missing developer profile
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
          profile_strength
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
          10
        );
        RAISE NOTICE 'Created missing developer profile for existing user: %', user_id;
      END IF;
    END IF;
    
    RETURN true;
  END IF;

  -- Validate role
  validated_role := CASE 
    WHEN user_role IN ('admin', 'recruiter', 'developer') THEN user_role 
    ELSE 'developer' 
  END;

  -- Create user profile
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    user_id,
    user_email,
    user_name,
    validated_role,
    CASE WHEN validated_role = 'developer' THEN true ELSE false END
  );

  RAISE NOTICE 'Created user profile for user_id: % with role: %', user_id, validated_role;

  -- Create role-specific profile
  IF validated_role = 'developer' THEN
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
      profile_strength
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
      10
    );
    RAISE NOTICE 'Created developer profile for user_id: %', user_id;
  ELSIF validated_role = 'recruiter' THEN
    INSERT INTO recruiters (
      user_id,
      company_name,
      website,
      company_size,
      industry
    ) VALUES (
      user_id,
      COALESCE(NULLIF(company_name, ''), 'Company'),
      '',
      '',
      ''
    );
    RAISE NOTICE 'Created recruiter profile for user_id: %', user_id;
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile for user_id %: %', user_id, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;