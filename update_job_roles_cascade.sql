DROP VIEW IF EXISTS public.job_roles_with_details CASCADE;

ALTER TABLE public.job_roles
DROP COLUMN salary_min,
DROP COLUMN salary_max;

ALTER TABLE public.job_roles
ADD COLUMN salary TEXT;

CREATE OR REPLACE VIEW public.job_roles_with_details AS
SELECT
    jr.id,
    jr.title,
    jr.description,
    jr.location,
    jr.job_type,
    jr.tech_stack,
    jr.salary,
    jr.experience_required,
    jr.is_active,
    jr.is_featured,
    jr.created_at,
    r.company_name
FROM
    job_roles jr
JOIN
    recruiters r ON jr.recruiter_id = r.user_id;
