-- Update RLS policies to allow users to update new columns
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (
  auth.uid() = sender_id AND
  (
    (archived_by_sender = true AND archived_by_sender_was = false) OR
    (deleted_by_sender = true AND deleted_by_sender_was = false)
  )
);

DROP POLICY IF EXISTS "Users can update received messages" ON public.messages;

CREATE POLICY "Users can update received messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (
  auth.uid() = receiver_id AND
  (
    (archived_by_receiver = true AND archived_by_receiver_was = false) OR
    (deleted_by_receiver = true AND deleted_by_receiver_was = false)
  )
);
