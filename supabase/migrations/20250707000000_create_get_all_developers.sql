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
  preferred_title text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.user_id as id,
    d.user_id,
    u.name,
    u.email,
    d.profile_pic_url as avatar_url,
    d.github_handle as github_username,
    d.location,
    d.skills,
    d.availability,
    d.desired_salary::text as preferred_title
  FROM
    developers d
  JOIN
    users u ON d.user_id = u.id;
END;
$$ LANGUAGE plpgsql;
