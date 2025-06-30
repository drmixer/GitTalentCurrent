/*
  # Portfolio Items and Developer Profile Improvements

  1. New Tables
    - `portfolio_items` - Developer portfolio items with projects, articles, certifications
      - `id` (uuid, primary key)
      - `developer_id` (uuid, foreign key to developers.user_id)
      - `title` (text, required)
      - `description` (text, optional)
      - `url` (text, optional)
      - `image_url` (text, optional)
      - `category` (text, default 'project')
      - `technologies` (text array)
      - `featured` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `portfolio_items` table
    - Add policies for public read access and developer management
    - Improve developer profile creation function

  3. Indexes and Triggers
    - Add indexes for performance
    - Add updated_at trigger
*/

-- Create portfolio_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES developers(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  url text,
  image_url text,
  category text DEFAULT 'project' CHECK (category IN ('project', 'article', 'certification', 'other')),
  technologies text[] DEFAULT '{}',
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on portfolio_items
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Public can read portfolio items" ON portfolio_items;
  DROP POLICY IF EXISTS "Developers can manage own portfolio items" ON portfolio_items;
  
  -- Create new policies
  CREATE POLICY "Public can read portfolio items"
    ON portfolio_items FOR SELECT
    TO anon, authenticated
    USING (true);

  CREATE POLICY "Developers can manage own portfolio items"
    ON portfolio_items FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM developers d
      WHERE d.user_id = auth.uid() AND d.user_id = portfolio_items.developer_id
    ));
END $$;

-- Create indexes for portfolio_items
CREATE INDEX IF NOT EXISTS idx_portfolio_items_developer ON portfolio_items(developer_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_featured ON portfolio_items(featured);

-- Create trigger for updated_at on portfolio_items
DROP TRIGGER IF EXISTS update_portfolio_items_updated_at ON portfolio_items;
CREATE TRIGGER update_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Improve developer profile creation function to handle existing profiles
CREATE OR REPLACE FUNCTION create_developer_profile(
  p_user_id uuid,
  p_github_handle text DEFAULT '',
  p_bio text DEFAULT '',
  p_availability boolean DEFAULT true,
  p_top_languages text[] DEFAULT '{}',
  p_linked_projects text[] DEFAULT '{}',
  p_location text DEFAULT '',
  p_experience_years integer DEFAULT 0,
  p_desired_salary integer DEFAULT 0
)
RETURNS boolean AS $$
DECLARE
  profile_exists boolean;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM developers WHERE user_id = p_user_id) INTO profile_exists;
  
  IF profile_exists THEN
    -- Update existing profile
    UPDATE developers SET
      github_handle = COALESCE(NULLIF(p_github_handle, ''), github_handle),
      bio = COALESCE(NULLIF(p_bio, ''), bio),
      availability = p_availability,
      top_languages = CASE WHEN array_length(p_top_languages, 1) > 0 THEN p_top_languages ELSE top_languages END,
      linked_projects = CASE WHEN array_length(p_linked_projects, 1) > 0 THEN p_linked_projects ELSE linked_projects END,
      location = COALESCE(NULLIF(p_location, ''), location),
      experience_years = CASE WHEN p_experience_years > 0 THEN p_experience_years ELSE experience_years END,
      desired_salary = CASE WHEN p_desired_salary > 0 THEN p_desired_salary ELSE desired_salary END,
      updated_at = now()
    WHERE user_id = p_user_id;
    
    RETURN true;
  END IF;

  -- Create developer profile
  INSERT INTO developers (
    user_id,
    github_handle,
    bio,
    availability,
    top_languages,
    linked_projects,
    location,
    experience_years,
    desired_salary
  )
  VALUES (
    p_user_id,
    p_github_handle,
    p_bio,
    p_availability,
    p_top_languages,
    p_linked_projects,
    p_location,
    p_experience_years,
    p_desired_salary
  );

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating/updating developer profile: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION create_developer_profile TO authenticated;