import React, { useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type { SandpackFiles, SandpackProviderProps } from '@codesandbox/sandpack-react';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | null | undefined;
  framework: 'react'; // current setup is React-specific; can be extended later
  assignmentId?: string;
  questionId?: string;
  onTestComplete?: () => void;
}

/**
 * Branded toolbar with a decoupled "Run Tests" button.
 * - No reliance on sandpack.listen (some builds don't expose it).
 * - We toggle a local "isRunning" after click and auto-reset with a timer.
 */
const RUN_RESET_MS = 2500;

const TestToolbar: React.FC<{
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
}> = ({ isRunning, setIsRunning }) => {
  const { sandpack } = useSandpack();
  const timerRef = useRef<number | null>(null);

  const handleRun = () => {
    // Clear any previous timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setIsRunning(true);
    // Trigger the run – SandpackTests will execute the test suite.
    sandpack.runSandpack();

    // Fallback: reset the button state after a short period.
    // You can tune RUN_RESET_MS or replace with richer logic later.
    timerRef.current = window.setTimeout(() => {
      setIsRunning(false);
      timerRef.current = null;
    }, RUN_RESET_MS);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderBottom: '1px solid #e5e7eb',
      background: '#fff',
    }}>
      {/* Status pill */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
        color: '#374151',
        fontWeight: 600,
        fontSize: 13,
      }}>
        {isRunning ? 'Running tests…' : 'Ready to run tests'}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleRun}
          disabled={isRunning}
          aria-busy={isRunning}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #2563eb',
            background: isRunning ? '#93c5fd' : '#2563eb',
            color: '#fff',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 700,
          }}
          aria-label="Run tests"
          title={isRunning ? 'Running…' : 'Run tests'}
        >
          <span style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '7px solid currentColor',
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
          }} />
          {isRunning ? 'Running…' : 'Run Tests'}
        </button>

        <button
          disabled
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#f3f4f6',
            color: '#6b7280',
            fontWeight: 700,
            cursor: 'not-allowed',
          }}
          title="Submit Solution (disabled for now)"
        >
          Submit Solution
        </button>
      </div>
    </div>
  );
};

const SandpackTest: React.FC<SandpackTestProps> = ({ starterCode, testCode }) => {
  const [isRunning, setIsRunning] = useState(false);

  const files = useMemo<SandpackFiles>(() => {
    return {
      '/src/App.tsx': { code: starterCode ?? '', active: true },
      '/src/App.test.tsx': { code: testCode ?? '', hidden: false },
    };
  }, [starterCode, testCode]);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      template={'react-ts' as SandpackProviderProps['template']}
      customSetup={{
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1',
          '@testing-library/user-event': '^14.5.2',
          vitest: '^0.34.6', // available for the runner; tests use fireEvent for stability
        },
      }}
      files={files}
      options={{
        autorun: true,               // compile on load; does not auto-run tests
        initMode: 'immediate',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        showConsole: false,
        visibleFiles: ['/src/App.tsx', '/src/App.test.tsx'],
        activeFile: '/src/App.tsx',
      }}
    >
      {/* Hide only the built-in test action buttons inside the Tests panel */}
      <style>{`
        .gt-tests [class*="sp-test-actions"] button,
        .gt-tests [data-testid="test-actions"] button {
          display: none !important;
        }
      `}</style>

      <SandpackLayout>
        <div style={{ display: 'flex', width: '100%' }}>
          {/* Editor */}
          <div style={{ flex: 1 }}>
            <SandpackCodeEditor
              style={{ height: '60vh' }}
              showTabs
              showLineNumbers
              showInlineErrors
            />
          </div>

          {/* Console + Tests */}
          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
            {/* Console header + body (dark) */}
            <div style={{ borderBottom: '1px solid #e5e7eb' }}>
              <div style={{
                height: 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                background: '#0f172a',
                color: '#e2e8f0',
                fontWeight: 700,
              }}>
                Console Output
              </div>
              <div style={{ height: 140, background: '#0f172a' }}>
                <SandpackConsole
                  maxMessageCount={200}
                  showHeader={false}
                  standalone
                  style={{
                    height: '100%',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* Custom toolbar */}
            <TestToolbar isRunning={isRunning} setIsRunning={setIsRunning} />

            {/* Tests (results only; built-in buttons hidden) */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <SandpackTests
                className="gt-tests"
                showVerboseButton={false}
                showWatchButton={false}
                verbose={true}
                watchMode={false}
                style={{ height: '100%' }}
              />
            </div>
          </div>
        </div>
      </SandpackLayout>
    </SandpackProvider>
  );
};

export default SandpackTest;
