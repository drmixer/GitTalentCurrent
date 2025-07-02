/*
  # Update Messaging System for Job Interest

  1. Changes
    - Update can_message function to allow developers to express interest in jobs
    - Modify RLS policy for messages to allow job interest messages
    - Add trigger to create notifications when developers express interest

  2. Security
    - Maintain RLS while allowing proper communication
    - Ensure proper access controls
*/

-- Update can_message function to allow developers to express interest in jobs
CREATE OR REPLACE FUNCTION can_message(sender_id uuid, receiver_id uuid)
RETURNS boolean AS $$
DECLARE
  sender_role text;
  receiver_role text;
  has_prior_message boolean;
BEGIN
  -- Get roles
  SELECT role INTO sender_role FROM users WHERE id = sender_id;
  SELECT role INTO receiver_role FROM users WHERE id = receiver_id;
  
  -- Admin can message anyone
  IF sender_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Anyone can message admin
  IF receiver_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Recruiter can message any developer
  IF sender_role = 'recruiter' AND receiver_role = 'developer' THEN
    RETURN true;
  END IF;
  
  -- Developer can only message recruiters who have messaged them first
  -- OR if they're expressing interest in a job (this will be checked in the RLS policy)
  IF sender_role = 'developer' AND receiver_role = 'recruiter' THEN
    -- Check if the recruiter has messaged this developer before
    SELECT EXISTS (
      SELECT 1 FROM messages
      WHERE sender_id = receiver_id  -- Recruiter is sender
      AND receiver_id = sender_id    -- Developer is receiver
    ) INTO has_prior_message;
    
    RETURN has_prior_message;
    -- Note: Job interest messages will be allowed by the RLS policy directly
  END IF;
  
  -- Default: no messaging allowed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update messaging policies to allow job interest messages
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND 
    (
      -- Normal messaging rules
      can_message(auth.uid(), receiver_id) OR
      
      -- Special case: Developer expressing interest in a job
      (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer') AND
        EXISTS (SELECT 1 FROM users WHERE id = receiver_id AND role = 'recruiter') AND
        job_role_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM job_roles 
          WHERE id = job_role_id AND recruiter_id = receiver_id
        )
      )
    )
  );

-- Create a trigger function to create notifications for job interest
CREATE OR REPLACE FUNCTION handle_job_interest_notification()
RETURNS TRIGGER AS $$
DECLARE
  job_title text;
  developer_name text;
  recruiter_id uuid;
BEGIN
  -- Check if this is a job interest message (developer to recruiter with job_role_id)
  IF NEW.job_role_id IS NOT NULL THEN
    -- Get the developer's name
    SELECT name INTO developer_name FROM users WHERE id = NEW.sender_id;
    
    -- Get the job title
    SELECT title, recruiter_id INTO job_title, recruiter_id FROM job_roles WHERE id = NEW.job_role_id;
    
    -- If this is a developer messaging a recruiter about a job
    IF EXISTS (
      SELECT 1 FROM users WHERE id = NEW.sender_id AND role = 'developer'
    ) AND recruiter_id = NEW.receiver_id THEN
      -- Create a notification for the recruiter
      PERFORM create_notification(
        NEW.receiver_id,
        'job_interest',
        NEW.job_role_id,
        'job_roles',
        developer_name || ' expressed interest in your job: ' || job_title
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS job_interest_notification_trigger ON messages;
CREATE TRIGGER job_interest_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_job_interest_notification();