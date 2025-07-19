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

-- Add RLS policies for profile pictures
CREATE POLICY "Allow authenticated users to upload profile pics"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profile-pics');

CREATE POLICY "Allow users to update their own profile pics"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner)
  WITH CHECK (bucket_id = 'profile-pics');

-- Add RLS policies for company logos
CREATE POLICY "Allow authenticated users to upload company logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Allow users to update their own company logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner)
  WITH CHECK (bucket_id = 'company-logos');