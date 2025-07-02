/*
  # Add Job Interest Trigger and Notification Functions

  1. Changes
    - Add trigger for general message notifications
    - Update job interest notification to include more details
    - Add function to mark notifications as read

  2. Security
    - Maintain RLS while allowing proper notification creation
    - Ensure proper access controls
*/

-- Create a trigger function for general message notifications
CREATE OR REPLACE FUNCTION handle_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  sender_name text;
  message_preview text;
BEGIN
  -- Get the sender's name
  SELECT name INTO sender_name FROM users WHERE id = NEW.sender_id;
  
  -- Create a message preview (first 50 characters)
  message_preview := substring(NEW.body from 1 for 50);
  IF length(NEW.body) > 50 THEN
    message_preview := message_preview || '...';
  END IF;
  
  -- Create a notification for the receiver
  -- Skip if it's a job interest message (handled by the other trigger)
  IF NEW.job_role_id IS NULL THEN
    PERFORM create_notification(
      NEW.receiver_id,
      'message',
      NEW.id,
      'messages',
      sender_name || ': ' || message_preview
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_message_notification();

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
  p_notification_ids uuid[]
)
RETURNS boolean AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE id = ANY(p_notification_ids)
  AND user_id = auth.uid();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error marking notifications as read: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_as_read()
RETURNS boolean AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = auth.uid()
  AND is_read = false;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error marking all notifications as read: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_notifications_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_as_read TO authenticated;