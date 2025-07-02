/*
  # Add Notifications Table

  1. New Tables
    - `notifications` - Stores notifications for users
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `type` (text, notification type)
      - `entity_id` (uuid, related entity ID)
      - `entity_type` (text, related entity type)
      - `message` (text, notification message)
      - `is_read` (boolean, read status)
      - `created_at` (timestamptz, creation timestamp)

  2. Security
    - Enable RLS on notifications table
    - Add policies for user access
    - Create indexes for performance

  3. Functions
    - Add function to create notifications
    - Add trigger for job interest notifications
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  entity_id uuid,
  entity_type text,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (is_admin());

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_entity_id ON notifications(entity_id);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_entity_id uuid,
  p_entity_type text,
  p_message text
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    entity_id,
    entity_type,
    message
  ) VALUES (
    p_user_id,
    p_type,
    p_entity_id,
    p_entity_type,
    p_message
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;