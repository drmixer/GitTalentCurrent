CREATE OR REPLACE FUNCTION get_all_developers()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  github_username text,
  location text,
  skills text[],
  availability boolean,
  preferred_title text,
  -- Add other developer fields as needed
  profile_pic_url text,
  github_handle text,
  user_data json
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.user_id as id,
    d.user_id,
    u.name,
    u.email,
    u.avatar_url,
    d.github_handle as github_username,
    d.location,
    d.skills,
    d.availability,
    d.desired_salary::text as preferred_title,
    d.profile_pic_url,
    d.github_handle,
    json_build_object('name', u.name, 'avatar_url', u.avatar_url) as user_data
  FROM
    developers d
  JOIN
    users u ON d.user_id = u.id;
END;
$$ LANGUAGE plpgsql;
