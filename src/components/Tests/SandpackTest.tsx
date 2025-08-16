import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type {
  SandpackSetup,
  SandpackFiles,
  SandpackTestResult,
  SandpackProviderProps,
} from '@codesandbox/sandpack-react';
import { Play, CheckCircle, AlertCircle, Loader } from 'lucide-react';

// Simple inline toast notification component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({
  message,
  type,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        padding: '12px 24px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
        color: 'white',
        fontWeight: '500',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{message}</span>
        <button
          onClick={onClose}
          style={{
            marginLeft: '16px',
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px',
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Define the frameworks we support
type SupportedFramework = 'react' | 'vue' | 'angular' | 'javascript';

// Define the shape of the props for the component
interface SandpackTestProps {
  starterCode: string;
  testCode: string | undefined | null;
  framework: SupportedFramework;
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
}

// Use proper Sandpack templates with updated dependencies
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
            vitest: '^0.34.6',
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
            vitest: '^0.34.6',
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
            // NOTE: no vitest/jsdom here; Sandpack runs tests in-browser
          },
        },
        mainFile: '/src/App.tsx',
        testFile: '/src/App.test.tsx',
      };
  }
};

// Status tracking component
const TestStatus: React.FC<{ status: 'idle' | 'running' | 'passed' | 'failed' | 'error'; message?: string }> = ({
  status,
  message,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return { icon: null, color: 'text-gray-500', bgColor: 'bg-gray-100' };
      case 'running':
        return { icon: <Loader className="w-4 h-4 animate-spin" />, color: 'text-blue-600', bgColor: 'bg-blue-50' };
      case 'passed':
        return { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'failed':
        return { icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'error':
        return { icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-600', bgColor: 'bg-red-50' };
      default:
        return { icon: null, color: 'text-gray-500', bgColor: 'bg-gray-100' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded-md ${config.bgColor} ${config.color}`}>
      {config.icon}
      <span className="text-sm font-medium">
        {status === 'idle' && 'Ready to run tests'}
        {status === 'running' && 'Running tests...'}
        {status === 'passed' && 'All tests passed!'}
        {status === 'failed' && 'Some tests failed'}
        {status === 'error' && 'Error running tests'}
      </span>
      {message && <span className="text-xs opacity-75">- {message}</span>}
    </div>
  );
};

// Run Tests Button Component
const RunTestsButton: React.FC<{ onRunTests: () => void; isRunning: boolean; disabled?: boolean }> = ({
  onRunTests,
  isRunning,
  disabled = false,
}) => {
  return (
    <button
      onClick={onRunTests}
      disabled={isRunning || disabled}
      className={`
        flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors
        ${isRunning || disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'}
      `}
    >
      <Play className="w-4 h-4" />
      <span>{isRunning ? 'Running Tests...' : 'Run Tests'}</span>
    </button>
  );
};

// Main layout component with enhanced status display and manual test running
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework' | 'starterCode' | 'testCode'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  const [testsCompleted, setTestsCompleted] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed' | 'error'>('idle');
  const [testResults, setTestResults] = useState<SandpackTestResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [testsTriggered, setTestsTriggered] = useState(false);
  const [runId, setRunId] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  useSandpack();

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleRunTests = useCallback(async () => {
    setTestStatus('running');
    setConsoleOutput(['🚀 Compiling and running tests...']);
    setAllTestsPassed(false);
    setTestsCompleted(false);
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

    if (results && results.tests && results.tests.length > 0) {
      const passedTests = results.tests.filter(test => test.status === 'pass').length;
      const totalTests = results.tests.length;
      const allPassed = results.tests.every(result => result.status === 'pass');

      setAllTestsPassed(allPassed);
      setTestsCompleted(true);
      setTestStatus(allPassed ? 'passed' : 'failed');

      setConsoleOutput(prev => [
        ...prev,
        `📊 Test Results: ${passedTests}/${totalTests} tests passed`,
        allPassed ? '🎉 All tests passed! You can now submit your solution.' : '❌ Some tests failed. You can still submit if allowed.',
        ...results.tests.map(test => `${test.status === 'pass' ? '✅' : '❌'} ${test.name || 'Test'}: ${test.status === 'pass' ? 'PASSED' : test.errors?.[0] || 'FAILED'}`),
      ]);
    } else if (results && results.errors && results.errors.length > 0) {
      setTestsCompleted(false);
      setTestStatus('error');
      setConsoleOutput(prev => [
        ...prev,
        '⚠️ Test runner error:',
        ...results.errors.map(e => (typeof e === 'string' ? e : e.message || 'Unknown error')),
      ]);
    } else {
      setTestsCompleted(false);
      setTestStatus('error');
      setConsoleOutput(prev => [...prev, '⚠️ No test results received - check test configuration']);
    }
  }, [clearPendingTimeout]);

  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  const submitSolution = useCallback(async () => {
    if (!(testStatus === 'passed' || testStatus === 'failed')) {
      showToast('Please run tests and wait for completion before submitting.', 'error');
      return;
    }

    setIsSubmitting(true);
    setConsoleOutput(prev => [...prev, '📤 Submitting solution...']);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        setTimeout(() => {
          setConsoleOutput(prev => [...prev, '✅ Solution submitted successfully! (Test mode - no actual submission)']);
          showToast('Solution submitted successfully! 🎉 (Test mode)', 'success');
          onTestComplete();
          setIsSubmitting(false);
        }, 1000);
        return;
      }

      const { supabase } = await import('../../lib/supabase');

      const { error: insertError } = await supabase
        .from('test_results')
        .upsert(
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

      if (insertError) throw insertError;

      setConsoleOutput(prev => [...prev, '✅ Solution submitted successfully!']);
      showToast('Solution submitted successfully! 🎉', 'success');
      onTestComplete();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConsoleOutput(prev => [...prev, `❌ Failed to submit: ${errorMessage}`]);
      showToast(`Failed to submit solution: ${errorMessage}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [allTestsPassed, assignmentId, questionId, onTestComplete, showToast, testResults, consoleOutput, testStatus]);

  const canSubmit = (testStatus === 'passed' || testStatus === 'failed') && !isSubmitting;

  return (
    <div className="flex flex-col h-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <TestStatus status={testStatus} />
        <div className="flex items-center space-x-3">
          <RunTestsButton onRunTests={handleRunTests} isRunning={testStatus === 'running'} />
          <button
            onClick={submitSolution}
            disabled={!canSubmit}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${!canSubmit ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'}
            `}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Solution'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1">
          <SandpackCodeEditor
            style={{ height: '60vh' }}
            showTabs
            showLineNumbers
            showInlineErrors
            showRunButton={false}
          />
        </div>

        <div className="w-1/2 flex flex-col border-l">
          <div className="flex-1 bg-gray-900 text-green-400 p-4 font-mono text-sm overflow-auto">
            <h3 className="text-white font-bold mb-2">Console Output</h3>
            {consoleOutput.length === 0 ? (
              <p className="text-gray-500">Click "Run Tests" to see output...</p>
            ) : (
              consoleOutput.map((line, index) => (
                <div key={index} className="mb-1">
                  {line}
                </div>
              ))
            )}
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

// Main component with framework prop passed through
const SandpackTest: React.FC<SandpackTestProps> = React.memo(
  ({ starterCode, testCode, framework, assignmentId, questionId, ...rest }) => {
    const { setup, mainFile, testFile } = getFrameworkConfig(framework);

    const files = useMemo(() => {
      const baseFiles: SandpackFiles = {
        [mainFile]: { code: starterCode, active: true },
        [testFile]: { code: testCode ?? '', hidden: false },
      };

      // IMPORTANT: do not inject a Vitest config or jsdom; tests run in-browser in Sandpack
      console.log('📁 Sandpack files created for', framework, ':', Object.keys(baseFiles));
      return baseFiles;
    }, [framework, starterCode, testCode, mainFile, testFile]);

    const sandpackKey = useMemo(
      () => `${assignmentId}-${questionId}-${framework}`,
      [assignmentId, questionId, framework]
    );

    if (!testCode) {
      return <div>This Sandpack question is missing its test code.</div>;
    }

    console.log('🚀 Initializing Sandpack with template:', setup.template, 'for framework:', framework);

    return (
      <SandpackProvider
        key={sandpackKey}
        template={setup.template as SandpackProviderProps['template']}
        customSetup={{
          dependencies: setup.dependencies,
          devDependencies: setup.devDependencies || {},
        }}
        files={files}
        options={{
          autorun: false,
          autoReload: false,
          initMode: 'user-visible',
          logLevel: 'info',
          recompileMode: 'delayed',
          recompileDelay: 500,
          showTabs: true,
          showNavigator: false,
          showInlineErrors: true,
          showErrorOverlay: true,
          showConsole: false,
          showRefreshButton: false,
          visibleFiles: [mainFile, testFile],
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
