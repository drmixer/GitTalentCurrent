/*
  # Add Job Import Functions

  1. New Functions
    - `parse_csv_tech_stack` - Converts comma-separated tech stack string to array
    - `validate_job_type` - Ensures job type is one of the allowed values
    - `import_job_posting` - Imports a single job posting with validation

  2. Security
    - All functions use SECURITY DEFINER to bypass RLS
    - Functions check that the user is a recruiter or admin
    - Input validation to prevent SQL injection

  3. Features
    - CSV import support for job postings
    - Validation of required fields and data types
    - Error handling and reporting
*/

-- Function to parse CSV tech stack string into an array
CREATE OR REPLACE FUNCTION parse_csv_tech_stack(tech_stack_str text)
RETURNS text[] AS $$
DECLARE
  result text[];
BEGIN
  -- Split the string by commas and trim each value
  SELECT array_agg(trim(t)) INTO result
  FROM unnest(string_to_array(tech_stack_str, ',')) AS t
  WHERE trim(t) != '';
  
  RETURN COALESCE(result, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate job type
CREATE OR REPLACE FUNCTION validate_job_type(job_type text)
RETURNS text AS $$
BEGIN
  IF job_type IN ('Full-time', 'Part-time', 'Contract', 'Freelance') THEN
    RETURN job_type;
  ELSE
    RAISE EXCEPTION 'Invalid job_type: %. Must be one of: Full-time, Part-time, Contract, Freelance', job_type;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to import a job posting
CREATE OR REPLACE FUNCTION import_job_posting(
  p_recruiter_id uuid,
  p_title text,
  p_description text,
  p_location text,
  p_job_type text,
  p_tech_stack text,
  p_salary_min integer,
  p_salary_max integer,
  p_experience_required text DEFAULT '',
  p_is_active boolean DEFAULT true
)
RETURNS uuid AS $$
DECLARE
  new_job_id uuid;
  is_recruiter_or_admin boolean;
BEGIN
  -- Check if user is a recruiter or admin
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_recruiter_id AND (role = 'recruiter' OR role = 'admin')
  ) INTO is_recruiter_or_admin;
  
  IF NOT is_recruiter_or_admin THEN
    RAISE EXCEPTION 'User is not a recruiter or admin';
  END IF;
  
  -- Validate required fields
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  
  IF p_description IS NULL OR trim(p_description) = '' THEN
    RAISE EXCEPTION 'Description is required';
  END IF;
  
  IF p_location IS NULL OR trim(p_location) = '' THEN
    RAISE EXCEPTION 'Location is required';
  END IF;
  
  -- Validate job type
  DECLARE
    validated_job_type text;
  BEGIN
    validated_job_type := validate_job_type(p_job_type);
    
    -- Validate salary range
    IF p_salary_min < 0 THEN
      RAISE EXCEPTION 'Minimum salary cannot be negative';
    END IF;
    
    IF p_salary_max < 0 THEN
      RAISE EXCEPTION 'Maximum salary cannot be negative';
    END IF;
    
    IF p_salary_min > p_salary_max THEN
      RAISE EXCEPTION 'Minimum salary cannot be greater than maximum salary';
    END IF;
    
    -- Parse tech stack
    DECLARE
      parsed_tech_stack text[];
    BEGIN
      parsed_tech_stack := parse_csv_tech_stack(p_tech_stack);
      
      -- Insert job posting
      INSERT INTO job_roles (
        recruiter_id,
        title,
        description,
        location,
        job_type,
        tech_stack,
        salary_min,
        salary_max,
        experience_required,
        is_active
      ) VALUES (
        p_recruiter_id,
        trim(p_title),
        trim(p_description),
        trim(p_location),
        validated_job_type,
        parsed_tech_stack,
        p_salary_min,
        p_salary_max,
        COALESCE(trim(p_experience_required), ''),
        p_is_active
      ) RETURNING id INTO new_job_id;
      
      RETURN new_job_id;
    END;
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error importing job posting: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to import multiple job postings
CREATE OR REPLACE FUNCTION import_job_postings(
  p_recruiter_id uuid,
  p_jobs jsonb
)
RETURNS TABLE (
  job_id uuid,
  title text,
  success boolean,
  error_message text
) AS $$
DECLARE
  job_record jsonb;
  new_job_id uuid;
  job_title text;
  job_success boolean;
  job_error text;
BEGIN
  -- Check if user is a recruiter or admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_recruiter_id AND (role = 'recruiter' OR role = 'admin')
  ) THEN
    RAISE EXCEPTION 'User is not a recruiter or admin';
  END IF;
  
  -- Process each job
  FOR job_record IN SELECT * FROM jsonb_array_elements(p_jobs)
  LOOP
    BEGIN
      job_title := job_record->>'title';
      
      -- Import job
      SELECT import_job_posting(
        p_recruiter_id,
        job_record->>'title',
        job_record->>'description',
        job_record->>'location',
        job_record->>'job_type',
        job_record->>'tech_stack',
        (job_record->>'salary_min')::integer,
        (job_record->>'salary_max')::integer,
        job_record->>'experience_required',
        COALESCE((job_record->>'is_active')::boolean, true)
      ) INTO new_job_id;
      
      job_success := true;
      job_error := NULL;
    EXCEPTION
      WHEN OTHERS THEN
        new_job_id := NULL;
        job_success := false;
        job_error := SQLERRM;
    END;
    
    -- Return result for this job
    job_id := new_job_id;
    title := job_title;
    success := job_success;
    error_message := job_error;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION parse_csv_tech_stack TO authenticated;
GRANT EXECUTE ON FUNCTION validate_job_type TO authenticated;
GRANT EXECUTE ON FUNCTION import_job_posting TO authenticated;
GRANT EXECUTE ON FUNCTION import_job_postings TO authenticated;