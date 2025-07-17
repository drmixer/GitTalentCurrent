-- Policies for 'messages' table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can send messages" ON messages;

  CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = sender_id AND
      (
        -- Admins can message anyone
        is_admin() OR
        -- Recruiters can message developers and admins
        (is_recruiter() AND (SELECT role FROM users WHERE id = receiver_id) IN ('developer', 'admin')) OR
        -- Developers can message admins
        (is_developer() AND (SELECT role FROM users WHERE id = receiver_id) = 'admin') OR
        -- Developers can reply to recruiters
        (is_developer() AND (SELECT role FROM users WHERE id = receiver_id) = 'recruiter' AND
          EXISTS (
            SELECT 1 FROM messages
            WHERE sender_id = receiver_id AND receiver_id = auth.uid()
          )
        )
      )
    );
END $$;
