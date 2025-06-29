/*
  # Fix Authentication Trigger

  1. Updates
    - Improve the trigger function to handle edge cases
    - Add better error handling
    - Ensure proper profile creation

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Improved function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  company_name text;
BEGIN
  -- Extract data from metadata
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'developer');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company');

  -- Insert into users table with basic info
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    CASE 
      WHEN user_role = 'developer' THEN true
      ELSE false
    END
  );

  -- Create role-specific profile
  IF user_role = 'developer' THEN
    INSERT INTO developers (
      user_id, 
      github_handle, 
      bio, 
      availability, 
      top_languages, 
      linked_projects,
      location,
      experience_years,
      hourly_rate
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
      0
    );
  ELSIF user_role = 'recruiter' THEN
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
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;