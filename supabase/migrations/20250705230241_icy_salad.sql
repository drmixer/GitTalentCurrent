/*
  # Disable handle_new_user Trigger

  1. Changes
    - Drop the on_auth_user_created trigger
    - This prevents the handle_new_user function from running automatically
    - Profile creation will now be handled explicitly by the client

  2. Rationale
    - The trigger has been unreliable and sometimes silently fails
    - Moving profile creation to the client side gives better control and visibility
    - Allows for more robust error handling and recovery
*/

-- Drop the trigger that automatically creates user profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Disabled automatic user profile creation trigger. Profiles will now be created explicitly by the client.';
END $$;