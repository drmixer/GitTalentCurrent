-- Function to call the notify-user edge function
CREATE OR REPLACE FUNCTION notify_user_on_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/notify-user',
    json_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    )::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_SUPABASE_ANON_KEY>"}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new test assignments
CREATE TRIGGER on_new_test_assignment
AFTER INSERT ON test_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_user_on_change();

-- Trigger for completed test assignments
CREATE TRIGGER on_completed_test_assignment
AFTER UPDATE ON test_assignments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Completed')
EXECUTE FUNCTION notify_user_on_change();
