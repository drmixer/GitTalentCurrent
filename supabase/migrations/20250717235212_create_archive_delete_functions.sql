CREATE OR REPLACE FUNCTION archive_thread(p_user_id uuid, p_other_user_id uuid, p_job_role_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET is_archived = true
  WHERE
    (sender_id = p_user_id AND receiver_id = p_other_user_id AND (job_role_id = p_job_role_id OR p_job_role_id IS NULL)) OR
    (sender_id = p_other_user_id AND receiver_id = p_user_id AND (job_role_id = p_job_role_id OR p_job_role_id IS NULL));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_thread(p_user_id uuid, p_other_user_id uuid, p_job_role_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET is_deleted = true
  WHERE
    (sender_id = p_user_id AND receiver_id = p_other_user_id AND (job_role_id = p_job_role_id OR p_job_role_id IS NULL)) OR
    (sender_id = p_other_user_id AND receiver_id = p_user_id AND (job_role_id = p_job_role_id OR p_job_role_id IS NULL));
END;
$$ LANGUAGE plpgsql;
