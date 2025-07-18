-- Update archive_thread and delete_thread functions to use new columns
DROP FUNCTION IF EXISTS archive_thread(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS delete_thread(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION archive_thread(p_user_id uuid, p_other_user_id uuid, p_job_role_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.messages
  SET
    archived_by_sender = CASE WHEN sender_id = p_user_id THEN true ELSE archived_by_sender END,
    archived_by_receiver = CASE WHEN receiver_id = p_user_id THEN true ELSE archived_by_receiver END
  WHERE
    ((sender_id = p_user_id AND receiver_id = p_other_user_id) OR (sender_id = p_other_user_id AND receiver_id = p_user_id))
    AND (job_role_id = p_job_role_id OR p_job_role_id IS NULL);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_thread(p_user_id uuid, p_other_user_id uuid, p_job_role_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.messages
  SET
    deleted_by_sender = CASE WHEN sender_id = p_user_id THEN true ELSE deleted_by_sender END,
    deleted_by_receiver = CASE WHEN receiver_id = p_user_id THEN true ELSE deleted_by_receiver END
  WHERE
    ((sender_id = p_user_id AND receiver_id = p_other_user_id) OR (sender_id = p_other_user_id AND receiver_id = p_user_id))
    AND (job_role_id = p_job_role_id OR p_job_role_id IS NULL);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.archive_thread(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_thread(uuid, uuid, uuid) TO authenticated;
