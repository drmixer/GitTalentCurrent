// src/components/Tests/SandpackTest.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  useSandpack,
  SandpackFile,
} from '@codesandbox/sandpack-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Toast from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase'; // Using the global supabase client

// --- Auth Client Management (for submissions) ---
let authClient: SupabaseClient | null = null;
const getAuthClient = async (): Promise<SupabaseClient | null> => {
  if (authClient) return authClient;
  // This logic assumes you store the session info in localStorage
  const sessionData = localStorage.getItem('supabase.auth.token');
  if (!sessionData) {
    console.error('No auth token found in localStorage');
    return null;
  }
  const { access_token } = JSON.parse(sessionData);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${access_token}` } },
  });
  return authClient;
};

// --- TYPE DEFINITIONS ---
interface SandpackTestProps {
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
  files: Record<string, SandpackFile>;
  solution: Record<string, SandpackFile>;
}

// --- DATA FETCHING COMPONENT ---
// This is the main component you will import into your pages.
// It handles fetching the test data from Supabase before rendering the test environment.
export const SandpackTestWithSupabase: React.FC<{
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
}> = ({ assignmentId, questionId, onTestComplete }) => {
  const [files, setFiles] = useState<Record<string, SandpackFile> | null>(null);
  const [solution, setSolution] = useState<Record<string, SandpackFile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTestFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('questions')
          .select('template_files, solution')
          .eq('id', questionId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error('Question data not found.');

        setFiles(data.template_files as Record<string, SandpackFile>);
        setSolution(data.solution as Record<string, SandpackFile>);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred while fetching test files.');
        console.error('Error fetching test files:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTestFiles();
  }, [questionId]);

  if (loading) return <div>Loading Test Environment...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!files || !solution) return <div>Could not load test files. Please try again.</div>;

  return (
    <SandpackTest
      assignmentId={assignmentId}
      questionId={questionId}
      onTestComplete={onTestComplete}
      files={files}
      solution={solution}
    />
  );
};

// --- SANDPACK UI COMPONENT ---
// This component renders the actual Sandpack environment.
const SandpackTest: React.FC<Omit<SandpackTestProps, 'framework'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
  files,
  solution,
}) => {
  return (
    <SandpackProvider
      template="react-ts"
      files={{ ...files, ...solution }}
      options={{
        activeFile: Object.keys(solution)[0] || '/App.tsx',
        visibleFiles: [Object.keys(solution)[0] || '/App.tsx', '/tests/App.test.tsx'],
        recompileMode: 'delayed',
        recompileDelay: 300,
        autorun: true, // Autorun is fine now that we have a reliable listener
        autoReload: true,
      }}
    >
      <SandpackLayoutManager
        assignmentId={assignmentId}
        questionId={questionId}
        onTestComplete={onTestComplete}
      />
    </SandpackProvider>
  );
};

// --- SANDPACK LOGIC & LAYOUT MANAGER ---
// This component contains the core logic for listening to tests and handling submission.
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'files' | 'solution'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const { client } = useSandpack();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Reliable message listener for test results ---
  useEffect(() => {
    const unsubscribe = client.listen((message) => {
      // This is the key fix: We listen for Sandpack's official 'test_end' event.
      if (message.type === 'test' && message.event === 'test_end') {
        setTestResults(message.results);
      }
    });
    // Cleanup the listener when the component unmounts
    return unsubscribe;
  }, [client]);

  // --- Derived state to check if all tests have passed ---
  const allTestsPassed = useMemo(() => {
    if (!testResults) return false;
    return Array.isArray(testResults) && testResults.length > 0 && testResults.every((result) => result.status === 'pass');
  }, [testResults]);

  // --- Toast notification logic ---
  const showToast = useCallback((message: string, type: 'success' | 'error') => setToast({ message, type }), []);
  const closeToast = useCallback(() => setToast(null), []);

  // --- Submission logic ---
  const submitSolution = useCallback(async () => {
    // ... (Your submission logic remains the same)
  }, [allTestsPassed, assignmentId, questionId, onTestComplete, showToast, testResults]);

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      <SandpackLayout>
        <SandpackCodeEditor style={{ height: '60vh', minHeight: '400px' }} />
        <div style={{ height: '60vh', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e5e5', backgroundColor: '#f8f9fa' }}>
            Test Results
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <SandpackTests style={{ height: '100%' }} />
          </div>
        </div>
      </SandpackLayout>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={submitSolution}
          disabled={!allTestsPassed || isSubmitting}
          style={{
            padding: '10px 20px',
            background: !allTestsPassed || isSubmitting ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !allTestsPassed || isSubmitting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Solution'}
        </button>
      </div>
    </>
  );
};

// Make sure the default export is the data-fetching wrapper
export default SandpackTestWithSupabase;
