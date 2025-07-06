/*
  # Disable Automatic User Profile Creation Trigger

  1. Changes
    - Disable the on_auth_user_created trigger on auth.users table
    - This prevents automatic profile creation during auth
    - Allows the client to explicitly create profiles with proper data

  2. Reason
    - The automatic trigger was causing issues with GitHub authentication
    - We want more control over when and how profiles are created
    - This ensures proper handling of GitHub metadata and installation IDs
*/

-- Drop the trigger that automatically creates user profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Disabled automatic user profile creation trigger. Profiles will now be created explicitly by the client.';
END $$;