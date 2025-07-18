-- Add user-specific archive and delete columns to messages table
ALTER TABLE public.messages
ADD COLUMN archived_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN archived_by_receiver BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN deleted_by_receiver BOOLEAN NOT NULL DEFAULT FALSE;

-- Drop the old columns
ALTER TABLE public.messages
DROP COLUMN is_archived,
DROP COLUMN is_deleted;
