/*
  # Update developer salary field and add portfolio features

  1. Schema Changes
    - Rename hourly_rate to desired_salary in developers table
    - Add skills_categories and proficiency_levels for better skill management
    - Add portfolio_items table for non-GitHub projects
    - Add profile_strength and public_profile_slug fields
    - Add notification preferences

  2. New Tables
    - `portfolio_items` for showcasing non-GitHub work
    - Enhanced developer profile fields

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Rename hourly_rate to desired_salary and add new fields
DO $$
BEGIN
  -- Check if hourly_rate column exists and rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developers' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE developers RENAME COLUMN hourly_rate TO desired_salary;
  END IF;
  
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developers' AND column_name = 'skills_categories'
  ) THEN
    ALTER TABLE developers ADD COLUMN skills_categories jsonb DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developers' AND column_name = 'profile_strength'
  ) THEN
    ALTER TABLE developers ADD COLUMN profile_strength integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developers' AND column_name = 'public_profile_slug'
  ) THEN
    ALTER TABLE developers ADD COLUMN public_profile_slug text UNIQUE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developers' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE developers ADD COLUMN notification_preferences jsonb DEFAULT '{"email": true, "in_app": true, "assignments": true, "messages": true}';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developers' AND column_name = 'resume_url'
  ) THEN
    ALTER TABLE developers ADD COLUMN resume_url text;
  END IF;
END $$;

-- Create portfolio_items table
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

-- Portfolio items policies
CREATE POLICY "Developers can manage own portfolio items"
  ON portfolio_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM developers d
      WHERE d.user_id = auth.uid() AND d.user_id = portfolio_items.developer_id
    )
  );

CREATE POLICY "Public can read portfolio items"
  ON portfolio_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- Add updated_at trigger for portfolio_items
CREATE TRIGGER update_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique profile slug
CREATE OR REPLACE FUNCTION generate_profile_slug(user_name text, github_handle text)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Create base slug from github handle or name
  IF github_handle IS NOT NULL AND github_handle != '' THEN
    base_slug := lower(github_handle);
  ELSE
    base_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g'));
  END IF;
  
  -- Remove multiple dashes and trim
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM developers WHERE public_profile_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate profile strength
CREATE OR REPLACE FUNCTION calculate_profile_strength(dev_id uuid)
RETURNS integer AS $$
DECLARE
  strength integer := 0;
  dev_record developers%ROWTYPE;
  user_record users%ROWTYPE;
BEGIN
  -- Get developer and user records
  SELECT * INTO dev_record FROM developers WHERE user_id = dev_id;
  SELECT * INTO user_record FROM users WHERE id = dev_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Basic info (20 points)
  IF user_record.name IS NOT NULL AND user_record.name != '' THEN
    strength := strength + 5;
  END IF;
  
  IF user_record.email IS NOT NULL AND user_record.email != '' THEN
    strength := strength + 5;
  END IF;
  
  IF dev_record.location IS NOT NULL AND dev_record.location != '' THEN
    strength := strength + 5;
  END IF;
  
  IF dev_record.experience_years > 0 THEN
    strength := strength + 5;
  END IF;
  
  -- GitHub integration (25 points)
  IF dev_record.github_handle IS NOT NULL AND dev_record.github_handle != '' THEN
    strength := strength + 15;
  END IF;
  
  IF dev_record.bio IS NOT NULL AND dev_record.bio != '' THEN
    strength := strength + 10;
  END IF;
  
  -- Skills and projects (30 points)
  IF array_length(dev_record.top_languages, 1) >= 3 THEN
    strength := strength + 15;
  ELSIF array_length(dev_record.top_languages, 1) >= 1 THEN
    strength := strength + 10;
  END IF;
  
  IF array_length(dev_record.linked_projects, 1) >= 2 THEN
    strength := strength + 15;
  ELSIF array_length(dev_record.linked_projects, 1) >= 1 THEN
    strength := strength + 10;
  END IF;
  
  -- Salary expectations (10 points)
  IF dev_record.desired_salary > 0 THEN
    strength := strength + 10;
  END IF;
  
  -- Portfolio items (15 points)
  IF EXISTS (SELECT 1 FROM portfolio_items WHERE developer_id = dev_id) THEN
    strength := strength + 15;
  END IF;
  
  RETURN LEAST(strength, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- Update existing developers with profile slugs and strength
DO $$
DECLARE
  dev_record RECORD;
  user_record RECORD;
  new_slug text;
  new_strength integer;
BEGIN
  FOR dev_record IN SELECT * FROM developers WHERE public_profile_slug IS NULL LOOP
    -- Get user record
    SELECT * INTO user_record FROM users WHERE id = dev_record.user_id;
    
    -- Generate slug
    new_slug := generate_profile_slug(user_record.name, dev_record.github_handle);
    
    -- Calculate strength
    new_strength := calculate_profile_strength(dev_record.user_id);
    
    -- Update developer
    UPDATE developers 
    SET 
      public_profile_slug = new_slug,
      profile_strength = new_strength
    WHERE user_id = dev_record.user_id;
  END LOOP;
END $$;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_developers_profile_slug ON developers(public_profile_slug);
CREATE INDEX IF NOT EXISTS idx_developers_profile_strength ON developers(profile_strength);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_developer ON portfolio_items(developer_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_featured ON portfolio_items(featured);