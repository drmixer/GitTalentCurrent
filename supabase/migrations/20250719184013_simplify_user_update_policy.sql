-- Drop the existing policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create a new policy that allows users to update their own profile
CREATE POLICY "Users can update their own profile information"
ON public.users
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
