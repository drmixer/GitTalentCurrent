ALTER TABLE public.job_roles
DROP COLUMN salary_min,
DROP COLUMN salary_max;

ALTER TABLE public.job_roles
ADD COLUMN salary TEXT;
