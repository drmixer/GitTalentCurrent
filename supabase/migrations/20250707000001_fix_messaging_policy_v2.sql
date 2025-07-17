-- 1. Correct the logic for developers replying to recruiters.
-- 2. The previous logic was still flawed and has been corrected.
-- 3. This policy ensures that a developer can reply to a recruiter only if the recruiter has initiated the conversation.

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

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
        FROM messages m
        WHERE
          m.sender_id = receiver_id AND
          m.receiver_id = auth.uid()
      )
    )
  )
);

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Recreated "Users can send messages" policy with corrected logic for developer-recruiter messaging.';
END $$;
