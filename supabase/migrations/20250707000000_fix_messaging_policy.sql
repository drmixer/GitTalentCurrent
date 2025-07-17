-- 1. Correct the logic for developers replying to recruiters.
-- 2. The previous logic incorrectly checked if the recruiter had sent a message to themselves.
-- 3. This policy ensures that a developer can reply to a recruiter only if the recruiter has initiated the conversation.

-- Drop the existing policy
DROP POLICY "Users can send messages" ON public.messages;

-- Create the new policy with the corrected logic
CREATE POLICY "Users can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = sender_id) AND
  (
    is_admin() OR
    (is_recruiter() AND (get_user_role(receiver_id) = 'developer' OR get_user_role(receiver_id) = 'admin')) OR
    (is_developer() AND get_user_role(receiver_id) = 'admin') OR
    (
      is_developer() AND
      get_user_role(receiver_id) = 'recruiter' AND
      EXISTS (
        SELECT 1
        FROM messages
        WHERE
          sender_id = receiver_id AND
          receiver_id = auth.uid()
      )
    )
  )
);

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Recreated "Users can send messages" policy with corrected logic for developer-recruiter messaging.';
END $$;
