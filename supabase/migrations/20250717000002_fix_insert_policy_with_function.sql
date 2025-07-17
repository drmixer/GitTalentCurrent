-- Create a new function to check if a recruiter has contacted a developer
CREATE OR REPLACE FUNCTION has_recruiter_contacted_developer(recruiter_id UUID, developer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM messages
    WHERE sender_id = recruiter_id AND receiver_id = developer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the existing INSERT policy on the messages table
DROP POLICY IF EXISTS "Users can send messages based on their role" ON public.messages;

-- Create a new policy for INSERT with the corrected logic
CREATE POLICY "Users can send messages based on their role"
ON public.messages
FOR INSERT
WITH CHECK (
  (auth.uid() = sender_id) AND
  (
    -- Admins can message anyone
    is_admin() OR
    -- Recruiters can message developers and admins
    (is_recruiter() AND (get_user_role(receiver_id) IN ('developer', 'admin'))) OR
    -- Developers can message admins
    (is_developer() AND get_user_role(receiver_id) = 'admin') OR
    -- Developers can message recruiters who have messaged them first
    (is_developer() AND get_user_role(receiver_id) = 'recruiter' AND has_recruiter_contacted_developer(receiver_id, sender_id))
  )
);
