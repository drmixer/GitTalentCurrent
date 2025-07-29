-- Trigger for new messages
CREATE TRIGGER on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_user_on_change();

-- Trigger for new job applications
CREATE TRIGGER on_new_job_application
AFTER INSERT ON applied_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_user_on_change();
