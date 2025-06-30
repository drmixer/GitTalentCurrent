/*
  # Update Profile Strength Calculation

  1. New Functions
    - `calculate_profile_strength_rpc` - RPC function to calculate and update profile strength
    - Allows frontend to trigger profile strength recalculation

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - Checks that the user is authorized to update the profile

  3. Features
    - Automatically updates profile_strength field in developers table
    - Returns the calculated strength value
*/

-- Create a function to calculate and update profile strength
CREATE OR REPLACE FUNCTION calculate_profile_strength_rpc(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  calculated_strength integer;
  is_authorized boolean;
BEGIN
  -- Check if the user is authorized to update this profile
  -- Either it's their own profile or they're an admin
  SELECT 
    (auth.uid() = p_user_id) OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  INTO is_authorized;
  
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Not authorized to update this profile';
  END IF;

  -- Calculate the profile strength
  SELECT calculate_profile_strength(p_user_id) INTO calculated_strength;
  
  -- Update the profile_strength field in the developers table
  UPDATE developers
  SET profile_strength = calculated_strength
  WHERE user_id = p_user_id;
  
  -- Return the calculated strength
  RETURN calculated_strength;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating profile strength: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_profile_strength_rpc TO authenticated;