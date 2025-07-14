ALTER TABLE public.developer_profiles
ADD COLUMN bio text,
ADD COLUMN skills text[],
ADD COLUMN location text,
ADD COLUMN availability boolean,
ADD COLUMN linkedin_url text,
ADD COLUMN experience_years integer;
