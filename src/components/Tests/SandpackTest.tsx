import React, { useState, useEffect, useMemo } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackTests,
  useSandpack,
  SandpackFileExplorer,
} from '@codesandbox/sandpack-react';
import type { SandpackSetup, SandpackFiles } from '@codesandbox/sandpack-react';
import { supabase } from '../../lib/supabase';

// Define the frameworks we support
type SupportedFramework = 'react' | 'vue' | 'angular';

// Define the shape of the props for the component
interface SandpackTestProps {
  starterCode: string;
  testCode: string | undefined | null; // test_code can be nullable
  framework: SupportedFramework;
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void; // Callback to notify parent
}

// --- Framework Configurations ---
// This section defines the setup for each framework

const getFrameworkConfig = (framework: SupportedFramework): { setup: SandpackSetup, mainFile: string, testFile: string } => {
  switch (framework) {
    case 'vue':
      return {
        setup: {
          dependencies: {
            'vue': '^3.3.4',
            '@vue/test-utils': '^2.4.1',
            'vitest': '^0.34.6',
          },
        },
        mainFile: '/src/App.vue',
        testFile: '/src/App.spec.js',
      };
    case 'angular':
      return {
        setup: {
          dependencies: {
            '@angular/common': '^16.2.0',
            '@angular/compiler': '^16.2.0',
            '@angular/core': '^16.2.0',
            '@angular/platform-browser': '^16.2.0',
            'rxjs': '^7.8.0',
            'zone.js': '^0.13.0',
            'jasmine-core': '^5.1.1',
          },
          entry: '/src/main.ts',
        },
        mainFile: '/src/app/app.component.ts',
        testFile: '/src/app/app.component.spec.ts',
      };
    case 'react':
    default:
      return {
        setup: {
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1',
            '@testing-library/react': '^13.4.0',
            '@testing-library/jest-dom': '^5.16.5',
          },
        },
        mainFile: '/App.js',
        testFile: '/App.test.js',
      };
  }
};


// A helper component to listen for test results and send them to Supabase
// This component is no longer needed, logic will be moved into the main component
// const SupabaseTestReporter: ...

import { SandpackTestsProps } from '@codesandbox/sandpack-react';

// A custom test header with a "Run Tests" button
const CustomTestHeader: React.FC<{ onRunTests: () => void }> = ({ onRunTests }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px' }}>
        <h4>Tests</h4>
        <button onClick={onRunTests} style={{ padding: '4px 8px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
            Run Tests
        </button>
    </div>
);

// Child component that contains the UI and logic which depends on the Sandpack context
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const { sandpack } = useSandpack();
  const [testResults, setTestResults] = useState<SandpackTestsProps | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runTests = () => {
    sandpack.runTests();
  };

  const handleTestComplete = (payload: SandpackTestsProps) => {
    setTestResults(payload);
  };

  const submitSolution = async () => {
    if (!testResults) {
      alert('Please run the tests before submitting.');
      return;
    }
    const allTestsPassed = testResults.tests.every((t) => t.status === 'pass');
    if (!allTestsPassed) {
      alert('Please ensure all tests are passing before you submit.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('test_results').insert({
        assignment_id: assignmentId,
        question_id: questionId,
        score: 1,
        results: testResults,
        passed_test_cases: testResults.tests.length,
        total_test_cases: testResults.tests.length,
      });
      if (error) throw error;
      console.log('Solution submitted successfully!');
      onTestComplete();
    } catch (error) {
      console.error('Failed to submit solution:', error);
      alert('There was an error submitting your solution. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allTestsPassed = useMemo(() => {
    if (!testResults || typeof testResults !== 'object') return false;

    // Iterate over each test file in the results
    for (const fileName in testResults) {
      const fileResults = testResults[fileName];
      if (fileResults && fileResults.tests) {
        // Iterate over each test case in the file
        for (const testName in fileResults.tests) {
          if (fileResults.tests[testName].status !== 'pass') {
            return false; // If any test has not passed, return false
          }
        }
      }
    }
    // If all tests in all files have passed
    return Object.keys(testResults).length > 0;
  }, [testResults]);

  return (
    <>
      <SandpackLayout>
        <SandpackCodeEditor style={{ height: '60vh' }} />
        <SandpackTests
          style={{ height: '60vh' }}
          headerChildren={<CustomTestHeader onRunTests={runTests} />}
          onComplete={handleTestComplete}
        />
      </SandpackLayout>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={submitSolution}
          disabled={!allTestsPassed || isSubmitting}
          style={{
            padding: '10px 20px',
            background: !allTestsPassed || isSubmitting ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !allTestsPassed || isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Solution'}
        </button>
      </div>
    </>
  );
};


// Main (Parent) component responsible for setting up the Provider
const SandpackTest: React.FC<SandpackTestProps> = ({
  starterCode,
  testCode,
  framework,
  ...rest
}) => {
  const { setup, mainFile, testFile } = getFrameworkConfig(framework);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  const packageJson = JSON.stringify({
    name: `gittalent-${framework}-challenge`,
    dependencies: setup.dependencies,
    scripts: { test: 'react-scripts test' },
  });

  const files = {
    [mainFile]: { code: starterCode, active: true },
    [testFile]: { code: testCode, hidden: true },
    '/package.json': { code: packageJson, hidden: true },
  };

  return (
    <SandpackProvider customSetup={setup} files={files} options={{ autorun: false }}>
      <SandpackLayoutManager {...rest} />
    </SandpackProvider>
  );
};

export default SandpackTest;
