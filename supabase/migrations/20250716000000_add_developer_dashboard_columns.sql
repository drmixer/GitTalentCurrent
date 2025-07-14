ALTER TABLE public.developer_profiles
ADD COLUMN preferred_title text,
ADD COLUMN experience_years integer,
ADD COLUMN desired_salary integer,
ADD COLUMN profile_visibility boolean,
ADD COLUMN public_profile_slug text,
ADD COLUMN github_followers integer,
ADD COLUMN github_following integer,
ADD COLUMN github_public_repos integer,
ADD COLUMN github_top_repos text[],
ADD COLUMN github_contribution_streak integer,
ADD COLUMN github_avg_contributions_per_day numeric;
