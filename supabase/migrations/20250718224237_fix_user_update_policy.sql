-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create a new policy that allows users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (
      -- Allow users to update their own name, profile_pic_url, and company_logo_url
      (SELECT array_agg(column_name) FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('name', 'profile_pic_url', 'company_logo_url'))
      @>
      (SELECT array_agg(column_name) FROM information_schema.columns WHERE table_name = 'users' AND ordinal_position <= 3)
    )
  );
