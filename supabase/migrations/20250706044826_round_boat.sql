/*
  # Disable Automatic User Profile Creation Trigger

  1. Changes
    - Drop the on_auth_user_created trigger on auth.users table
    - This prevents automatic profile creation in the database
    - Client-side profile creation will be used instead

  2. Rationale
    - The automatic trigger was causing issues with GitHub authentication
    - Client-side profile creation provides more control and visibility
    - Prevents race conditions between client and server profile creation
*/

-- Drop the trigger that automatically creates user profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Disabled automatic user profile creation trigger. Profiles will now be created explicitly by the client.';
END $$;