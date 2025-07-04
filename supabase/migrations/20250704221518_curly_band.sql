/*
  # Fix GitHub Authentication Flow

  1. Changes
    - Add function to extract GitHub state parameter
    - Improve user profile creation from GitHub auth
    - Fix GitHub installation ID handling
    - Add better error handling for auth flows
*/

-- Function to extract GitHub state parameter
CREATE OR REPLACE FUNCTION extract_github_state(metadata jsonb)
RETURNS jsonb AS $$
DECLARE
  state_str text;
  state_obj jsonb;
BEGIN
  -- Try to get state from various possible locations
  state_str := metadata->>'state';
  
  IF state_str IS NULL THEN
    state_str := metadata->>'provider_token';
  END IF;
  
  IF state_str IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Try to parse as JSON
  BEGIN
    state_obj := state_str::jsonb;
    RETURN state_obj;
  EXCEPTION WHEN OTHERS THEN
    -- Try to parse as string that contains JSON
    BEGIN
      state_obj := ('"' || state_str || '"')::jsonb;
      RETURN state_obj;
    EXCEPTION WHEN OTHERS THEN
      RETURN '{}'::jsonb;
    END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update GitHub installation ID
CREATE OR REPLACE FUNCTION update_github_installation_id(
  p_user_id uuid,
  p_installation_id text
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
  is_authorized boolean;
  dev_record developers%ROWTYPE;
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
  SELECT * INTO dev_record FROM developers WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Create a basic developer profile if it doesn't exist
    INSERT INTO developers (
      user_id,
      github_handle,
      bio,
      availability,
      github_installation_id
    ) VALUES (
      p_user_id,
      '',
      '',
      true,
      p_installation_id
    );
    
    RAISE NOTICE 'Created new developer profile with installation ID: %', p_installation_id;
    RETURN true;
  END IF;

  -- Update the installation ID
  UPDATE developers
  SET 
    github_installation_id = p_installation_id,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RAISE NOTICE 'Updated installation ID to: % for user: %', p_installation_id, p_user_id;
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating GitHub installation ID: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Improve the handle_new_user trigger function to better handle GitHub users
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
  github_installation_id text;
  state_obj jsonb;
BEGIN
  RAISE NOTICE 'handle_new_user triggered for: % (provider: %)', NEW.id, NEW.app_metadata->>'provider';
  
  -- Extract state parameter if this is a GitHub auth
  IF NEW.app_metadata->>'provider' = 'github' THEN
    state_obj := extract_github_state(NEW.app_metadata);
    RAISE NOTICE 'Extracted state: %', state_obj;
  ELSE
    state_obj := '{}'::jsonb;
  END IF;

  -- Extract data from metadata with fallbacks
  user_role := COALESCE(
    state_obj->>'role',
    NEW.raw_user_meta_data->>'role', 
    'developer'
  );
  
  user_name := COALESCE(
    state_obj->>'name',
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    split_part(NEW.email, '@', 1)
  );
  
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');
  github_handle := COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'preferred_username', '');
  user_bio := COALESCE(NEW.raw_user_meta_data->>'bio', '');
  user_location := COALESCE(NEW.raw_user_meta_data->>'location', '');
  avatar_url := COALESCE(NEW.raw_user_meta_data->>'avatar_url', '');
  
  -- Extract GitHub installation ID from various possible locations in metadata
  github_installation_id := COALESCE(
    NEW.raw_user_meta_data->>'installation_id',
    NEW.raw_user_meta_data->>'app_installation_id',
    NEW.raw_user_meta_data->'github'->>'installation_id',
    NULL
  );

  -- Validate role
  IF user_role NOT IN ('admin', 'recruiter', 'developer') THEN
    user_role := 'developer';
  END IF;

  RAISE NOTICE 'Creating user with role: %, name: %, github: %', 
    user_role, user_name, github_handle;

  -- Insert into users table with basic info
  INSERT INTO public.users (id, email, name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    CASE WHEN user_role = 'developer' THEN true ELSE false END -- Developers are auto-approved
  );

  RAISE NOTICE 'User created in users table: %', NEW.id;

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    INSERT INTO public.developers (
      user_id,
      github_handle,
      bio,
      location,
      profile_pic_url,
      github_installation_id
    )
    VALUES (
      NEW.id,
      github_handle,
      user_bio,
      user_location,
      avatar_url,
      github_installation_id
    );
    
    RAISE NOTICE 'Developer profile created for: %', NEW.id;
  ELSIF user_role = 'recruiter' THEN
    INSERT INTO public.recruiters (user_id, company_name)
    VALUES (
      NEW.id,
      company_name
    );
    
    RAISE NOTICE 'Recruiter profile created for: %', NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process.
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION extract_github_state TO authenticated;
GRANT EXECUTE ON FUNCTION update_github_installation_id TO authenticated;
GRANT EXECUTE ON FUNCTION is_github_app_connected TO authenticated;