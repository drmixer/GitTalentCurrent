-- Drop existing policies on the messages table
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users manage own messages" ON public.messages;

-- Create a new policy for SELECT
CREATE POLICY "Users can read their own messages"
ON public.messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Create a new policy for INSERT
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
    (is_developer() AND get_user_role(receiver_id) = 'recruiter' AND (
      EXISTS (
        SELECT 1
        FROM messages m
        WHERE m.sender_id = receiver_id AND m.receiver_id = sender_id
      )
    ))
  )
);

-- Create a new policy for UPDATE
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Create a new policy for DELETE
CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);
