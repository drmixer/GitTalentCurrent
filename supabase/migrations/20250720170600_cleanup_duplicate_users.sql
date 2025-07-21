-- Create a temporary table to store the ids of the duplicate users
CREATE TEMP TABLE duplicate_users AS
SELECT id
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at) as rn
  FROM public.users
) t
WHERE t.rn > 1;

-- Delete the duplicate users from the users table
DELETE FROM public.users
WHERE id IN (SELECT id FROM duplicate_users);

-- Drop the temporary table
DROP TABLE duplicate_users;
