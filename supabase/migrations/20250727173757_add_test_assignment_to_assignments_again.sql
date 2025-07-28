-- This migration is a retry of a previous migration that may have failed.
-- It is safe to run this migration even if the column already exists.

DO $$
BEGIN
  IF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='assignments' and column_name='test_assignment_id')
  THEN
      ALTER TABLE "assignments" ADD COLUMN "test_assignment_id" uuid;
      ALTER TABLE "assignments" ADD CONSTRAINT "assignments_test_assignment_id_fkey" FOREIGN KEY (test_assignment_id) REFERENCES test_assignments(id) ON DELETE SET NULL;
  END IF;
END $$;
