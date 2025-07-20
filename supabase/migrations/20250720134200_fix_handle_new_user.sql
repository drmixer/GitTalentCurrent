CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into users table with basic info
  INSERT INTO users (id, email, name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
    (COALESCE(NEW.raw_user_meta_data->>'role', 'developer'))::text,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'developer') = 'developer' THEN true
      ELSE false
    END
  );

  -- If developer, create developer profile
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'developer') = 'developer' THEN
    INSERT INTO developers (user_id, github_handle, bio)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'user_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'bio', '')
    );
  END IF;

  -- If recruiter, create recruiter profile
  IF NEW.raw_user_meta_data->>'role' = 'recruiter' THEN
    INSERT INTO recruiters (user_id, company_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
