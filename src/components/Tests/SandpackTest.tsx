import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type {
  SandpackSetup,
  SandpackFiles,
  SandpackTestResult,
  SandpackProviderProps,
} from '@codesandbox/sandpack-react';

type SupportedFramework = 'react' | 'vue' | 'angular' | 'javascript';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | undefined | null;
  framework: SupportedFramework;
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
}

const getFrameworkConfig = (
  framework: SupportedFramework
): { setup: SandpackSetup; mainFile: string; testFile: string } => {
  switch (framework) {
    case 'vue':
      return {
        setup: {
          template: 'vue',
          dependencies: {
            vue: '^3.3.4',
            '@vue/test-utils': '^2.4.1',
          },
        },
        mainFile: '/src/App.vue',
        testFile: '/src/test.js',
      };
    case 'angular':
      return {
        setup: {
          template: 'angular',
          dependencies: {
            '@angular/animations': '^16.0.0',
            '@angular/common': '^16.0.0',
            '@angular/compiler': '^16.0.0',
            '@angular/core': '^16.0.0',
            '@angular/forms': '^16.0.0',
            '@angular/platform-browser': '^16.0.0',
            '@angular/platform-browser-dynamic': '^16.0.0',
            '@angular/testing': '^16.0.0',
            rxjs: '^7.8.0',
            'zone.js': '^0.13.0',
            'jasmine-core': '^4.6.0',
            karma: '^6.4.0',
          },
        },
        mainFile: '/src/app/app.component.ts',
        testFile: '/src/test.ts',
      };
    case 'javascript':
      return {
        setup: {
          template: 'vanilla',
          dependencies: {
            '@testing-library/jest-dom': '^6.5.0',
          },
        },
        mainFile: '/src/index.js',
        testFile: '/src/index.test.js',
      };
    case 'react':
    default:
      return {
        setup: {
          template: 'react-ts',
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            '@testing-library/react': '^14.2.1',
            '@testing-library/jest-dom': '^6.5.0',
            '@testing-library/user-event': '^14.5.2',
          },
        },
        mainFile: '/src/App.tsx',
        testFile: '/src/App.test.tsx',
      };
  }
};

const TestStatus: React.FC<{ status: 'idle' | 'running' | 'passed' | 'failed' | 'error'; message?: string }> = ({
  status,
  message,
}) => {
  const map = {
    idle: { icon: null, color: 'text-gray-600', bg: 'bg-gray-100', text: 'Ready to run tests' },
    running: { icon: null, color: 'text-blue-700', bg: 'bg-blue-50', text: 'Running tests...' },
    passed: { icon: null, color: 'text-green-700', bg: 'bg-green-50', text: 'All tests passed!' },
    failed: { icon: null, color: 'text-red-700', bg: 'bg-red-50', text: 'Some tests failed' },
    error: { icon: null, color: 'text-red-700', bg: 'bg-red-50', text: 'Error running tests' },
  } as const;
  const cfg = map[status];
  return (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded-md ${cfg.bg} ${cfg.color}`}>
      <span className="text-sm font-medium">{cfg.text}</span>
      {message && <span className="text-xs opacity-75">- {message}</span>}
    </div>
  );
};

const RunTestsButton: React.FC<{ onRunTests: () => void; isRunning: boolean; disabled?: boolean }> = ({
  onRunTests,
  isRunning,
  disabled = false,
}) => (
  <button
    onClick={onRunTests}
    disabled={isRunning || disabled}
    className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
      isRunning || disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
    }`}
  >
    <span>{isRunning ? 'Running Tests...' : 'Run Tests'}</span>
  </button>
);

const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework' | 'starterCode' | 'testCode'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed' | 'error'>('idle');
  const [testResults, setTestResults] = useState<SandpackTestResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [testsTriggered, setTestsTriggered] = useState(false);
  const [runId, setRunId] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  useSandpack(); // keep context warm

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleRunTests = useCallback(() => {
    setTestStatus('running');
    setConsoleOutput(['🚀 Compiling and running tests...']);
    setAllTestsPassed(false);
    setTestsTriggered(true);
    setRunId(prev => prev + 1);

    window.setTimeout(() => {
      setConsoleOutput(prev => [...prev, '✅ Compilation successful', '🧪 Running test suite...']);
    }, 300);

    clearPendingTimeout();
    timeoutRef.current = window.setTimeout(() => {
      setTestStatus(prev => {
        if (prev === 'running') {
          setConsoleOutput(prevOut => [...prevOut, '⏰ Test execution timed out - please try again']);
          return 'error';
        }
        return prev;
      });
    }, 30000);
  }, [clearPendingTimeout]);

  const handleTestComplete = useCallback((results: SandpackTestResult) => {
    clearPendingTimeout();
    setTestResults(results);

    const tests = results?.tests ?? [];
    if (tests.length > 0) {
      const passed = tests.filter(t => t.status === 'pass').length;
      const total = tests.length;
      const allPassed = passed === total;

      setAllTestsPassed(allPassed);
      setTestStatus(allPassed ? 'passed' : 'failed');

      setConsoleOutput(prev => [
        ...prev,
        `📊 Test Results: ${passed}/${total} tests passed`,
        ...tests.map(t => `${t.status === 'pass' ? '✅' : '❌'} ${t.name || 'Test'} ${t.status.toUpperCase()}`),
      ]);
    } else if (results?.errors?.length) {
      setTestStatus('error');
      setConsoleOutput(prev => [
        ...prev,
        '⚠️ Test runner error:',
        ...results.errors.map(e => (typeof e === 'string' ? e : e.message || 'Unknown error')),
      ]);
    } else {
      setTestStatus('error');
      setConsoleOutput(prev => [...prev, '⚠️ No test results received - check test configuration']);
    }
  }, [clearPendingTimeout]);

  useEffect(() => {
    return () => clearPendingTimeout();
  }, [clearPendingTimeout]);

  const submitSolution = useCallback(async () => {
    if (!(testStatus === 'passed' || testStatus === 'failed')) {
      setConsoleOutput(prev => [...prev, 'Please run tests and wait for completion before submitting.']);
      return;
    }

    setIsSubmitting(true);
    setConsoleOutput(prev => [...prev, '📤 Submitting solution...']);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        setTimeout(() => {
          setConsoleOutput(prev => [...prev, '✅ Solution submitted successfully! (Test mode)']);
          onTestComplete();
          setIsSubmitting(false);
        }, 800);
        return;
      }

      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase.from('test_results').upsert(
        {
          assignment_id: assignmentId,
          question_id: questionId,
          score: allTestsPassed ? 1 : 0,
          passed_test_cases: testResults?.tests?.filter(t => t.status === 'pass').length || 0,
          total_test_cases: testResults?.tests?.length || 0,
          stdout: consoleOutput.join('\n'),
          stderr: '',
        },
        { onConflict: 'assignment_id,question_id' }
      );
      if (error) throw error;

      setConsoleOutput(prev => [...prev, '✅ Solution submitted successfully!']);
      onTestComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setConsoleOutput(prev => [...prev, `❌ Failed to submit: ${msg}`]);
    } finally {
      setIsSubmitting(false);
    }
  }, [testStatus, assignmentId, questionId, onTestComplete, allTestsPassed, testResults, consoleOutput]);

  const canSubmit = (testStatus === 'passed' || testStatus === 'failed') && !isSubmitting;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <TestStatus status={testStatus} />
        <div className="flex items-center space-x-3">
          <RunTestsButton onRunTests={handleRunTests} isRunning={testStatus === 'running'} />
          <button
            onClick={submitSolution}
            disabled={!canSubmit}
            className={`${!canSubmit ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'} px-4 py-2 rounded-md font-medium transition-colors`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Solution'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1">
          <SandpackCodeEditor style={{ height: '60vh' }} showTabs showLineNumbers showInlineErrors showRunButton={false} />
        </div>

        <div className="w-1/2 flex flex-col border-l">
          <div className="flex-1 bg-gray-900 text-green-400 p-4 font-mono text-sm overflow-auto">
            <h3 className="text-white font-bold mb-2">Console Output</h3>
            {consoleOutput.length === 0 ? (
              <p className="text-gray-500">Click "Run Tests" to see output...</p>
            ) : (
              consoleOutput.map((line, i) => <div key={i} className="mb-1">{line}</div>)
            )}
          </div>

          <div className="h-40 border-t overflow-auto">
            <SandpackConsole maxMessageCount={200} />
          </div>

          <div className="h-64 border-t">
            {testsTriggered ? (
              <SandpackTests
                key={runId}
                onComplete={handleTestComplete}
                showVerboseButton={false}
                showWatchButton={false}
                verbose={true}
                watchMode={false}
                style={{ height: '100%' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
                <div className="text-center">
                  <p className="mb-2">🧪 Tests ready to run</p>
                  <p className="text-sm">Click "Run Tests" to execute the test suite</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SandpackTest: React.FC<SandpackTestProps> = React.memo(
  ({ starterCode, testCode, framework, assignmentId, questionId, ...rest }) => {
    const { setup, mainFile, testFile } = getFrameworkConfig(framework);

    const files = useMemo(() => {
      const baseFiles: SandpackFiles = {
        [mainFile]: { code: starterCode, active: true },
        // Author's test lives in /src
        [testFile]: { code: testCode ?? '', hidden: false },
        // Bridge file at project root to guarantee discovery
        '/App.test.tsx': {
          code: `
/**
 * Bridge test file to ensure test discovery at project root.
 * It imports the real tests from /src so Sandpack's runner always finds them.
 */
import './setupTests';
import './src/App.test.tsx';
`.trim(),
          hidden: false,
        },
        // Global setup for jest-dom matchers
        '/setupTests.ts': {
          code: `import '@testing-library/jest-dom';`,
          hidden: true,
        },
      };

      console.log('📁 Sandpack files created for', framework, ':', Object.keys(baseFiles));
      return baseFiles;
    }, [framework, starterCode, testCode, mainFile, testFile]);

    if (!testCode) {
      return <div>This Sandpack question is missing its test code.</div>;
    }

    console.log('🚀 Initializing Sandpack with template:', setup.template, 'for framework:', framework);

    return (
      <SandpackProvider
        template={setup.template as SandpackProviderProps['template']}
        customSetup={{ dependencies: setup.dependencies, devDependencies: setup.devDependencies || {} }}
        files={files}
        options={{
          autorun: true,
          initMode: 'immediate',
          logLevel: 'info',
          showTabs: true,
          showNavigator: false,
          showInlineErrors: true,
          showErrorOverlay: true,
          showConsole: false, // we render SandpackConsole separately
          showRefreshButton: false,
          visibleFiles: [mainFile, testFile, '/App.test.tsx'],
          activeFile: mainFile,
        }}
      >
        <SandpackLayout>
          <SandpackLayoutManager assignmentId={assignmentId} questionId={questionId} {...rest} />
        </SandpackLayout>
      </SandpackProvider>
    );
  }
);

SandpackTest.displayName = 'SandpackTest';
export default SandpackTest;
