-- Create the coding_tests table
CREATE TABLE IF NOT EXISTS coding_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    role TEXT,
    difficulty TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the coding_questions table
CREATE TABLE IF NOT EXISTS coding_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID REFERENCES coding_tests(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    language TEXT NOT NULL,
    starter_code TEXT,
    expected_output TEXT,
    test_cases JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the test_assignments table
CREATE TABLE IF NOT EXISTS test_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID REFERENCES developers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_roles(id) ON DELETE CASCADE,
    test_id UUID REFERENCES coding_tests(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, In-Progress, Completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the test_results table
CREATE TABLE IF NOT EXISTS test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES test_assignments(id) ON DELETE CASCADE,
    question_id UUID REFERENCES coding_questions(id) ON DELETE CASCADE,
    score INTEGER,
    stdout TEXT,
    stderr TEXT,
    passed_test_cases INTEGER,
    total_test_cases INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
