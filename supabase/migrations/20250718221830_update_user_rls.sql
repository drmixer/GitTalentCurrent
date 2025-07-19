-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create a new policy that allows users to update specific columns
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant update permissions on specific columns
GRANT UPDATE (profile_pic_url, company_logo_url, name) ON public.users TO authenticated;
