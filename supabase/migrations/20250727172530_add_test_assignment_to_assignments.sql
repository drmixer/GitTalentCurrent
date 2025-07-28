ALTER TABLE assignments
ADD COLUMN test_assignment_id UUID REFERENCES test_assignments(id) ON DELETE SET NULL;
