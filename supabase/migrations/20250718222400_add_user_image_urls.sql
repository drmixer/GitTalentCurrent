ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS profile_pic_url text,
ADD COLUMN IF NOT EXISTS company_logo_url text;
