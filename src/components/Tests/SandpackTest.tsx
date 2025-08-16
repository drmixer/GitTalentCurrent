import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type { SandpackFiles, SandpackProviderProps } from '@codesandbox/sandpack-react';

type Framework = 'react' | 'vue' | 'vanilla';

interface SandpackTestProps {
  // Code the candidate edits
  starterCode: string;
  // Tests for this question
  testCode: string | null | undefined;
  // Which stack to run for this question
  framework: Framework; // react (TS), vue (Vue 3 SFC), vanilla (TS)
  // Optional callback when user clicks Submit (enabled only when all tests pass)
  onSubmit?: (result: {
    allPassed: boolean;
    suites: { passed: number; total: number } | null;
    tests: { passed: number; total: number } | null;
    rawText: string;
  }) => void;
}

/**
 * Per-framework sandbox setup: template, file names, and dependencies.
 * We include '@testing-library/jest-dom' to avoid missing-dep errors if test files import it.
 */
const getSetup = (framework: Framework) => {
  switch (framework) {
    case 'react':
      return {
        template: 'react-ts' as SandpackProviderProps['template'],
        codeFile: '/src/App.tsx',
        testFile: '/src/App.test.tsx',
        deps: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1',
          '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2',
          vitest: '^0.34.6',
        },
      };
    case 'vue':
      return {
        template: 'vue3' as SandpackProviderProps['template'],
        codeFile: '/src/App.vue',
        testFile: '/src/App.test.ts',
        deps: {
          vue: '^3.4.21',
          '@testing-library/vue': '^8.0.3',
          '@testing-library/dom': '^9.3.4',
          '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2',
          vitest: '^0.34.6',
        },
      };
    case 'vanilla':
      return {
        template: 'vanilla-ts' as SandpackProviderProps['template'],
        codeFile: '/src/index.ts',
        testFile: '/src/index.test.ts',
        deps: {
          '@testing-library/dom': '^9.3.4',
          '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2',
          vitest: '^0.34.6',
        },
      };
    default:
      // Fallback to React TS
      return {
        template: 'react-ts' as SandpackProviderProps['template'],
        codeFile: '/src/App.tsx',
        testFile: '/src/App.test.tsx',
        deps: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1',
          '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2',
          vitest: '^0.34.6',
        },
      };
  }
};

/**
 * Extract pass/fail summary from the Tests panel text.
 * Supports typical jest-format output inside SandpackTests.
 */
function parseSummaryFromText(text: string) {
  const suitesPassRe = /Test suites?:\s*(\d+)\s*passed.*?(\d+)\s*total/i;
  const suitesAltRe = /Test suites?:.*?(\d+)\s*total.*?(\d+)\s*passed/i;
  const testsPassRe = /Tests?:\s*(\d+)\s*passed.*?(\d+)\s*total/i;
  const testsAltRe = /Tests?:.*?(\d+)\s*total.*?(\d+)\s*passed/i;

  const suitesMatch =
    text.match(suitesPassRe) ||
    text.match(suitesAltRe);
  const testsMatch =
    text.match(testsPassRe) ||
    text.match(testsAltRe);

  const suites =
    suitesMatch && suitesMatch.length >= 3
      ? { passed: Number(suitesMatch[1]), total: Number(suitesMatch[2]) }
      : null;

  const tests =
    testsMatch && testsMatch.length >= 3
      ? { passed: Number(testsMatch[1]), total: Number(testsMatch[2]) }
      : null;

  // Consider any explicit failures as failing
  const hasFailures =
    /failed,\s*[1-9]/i.test(text) ||
    /●|✕|FAIL\b/i.test(text);

  const allPassed =
    !hasFailures &&
    (!!suites ? suites.passed === suites.total && suites.total > 0 : true) &&
    (!!tests ? tests.passed === tests.total && tests.total > 0 : true);

  return { allPassed, suites, tests };
}

const RUN_RESET_FALLBACK_MS = 5000;

/**
 * Branded toolbar with a decoupled "Run Tests" button and a Submit button.
 * - No reliance on sandpack.listen (some builds don't expose it).
 * - Run triggers sandpack.runSandpack(); a MutationObserver will clear running state.
 */
const TestToolbar: React.FC<{
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  canSubmit: boolean;
  onSubmit?: () => void;
}> = ({ isRunning, setIsRunning, canSubmit, onSubmit }) => {
  const { sandpack } = useSandpack();
  const timerRef = useRef<number | null>(null);

  const handleRun = () => {
    // Reset any previous timer and disable submit until new results appear
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(true);
    // Trigger test execution
    sandpack.runSandpack();

    // Fallback so the button never gets stuck if DOM parsing fails
    timerRef.current = window.setTimeout(() => {
      setIsRunning(false);
      timerRef.current = null;
    }, RUN_RESET_FALLBACK_MS);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

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
          onClick={() => onSubmit?.()}
          disabled={!canSubmit}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: canSubmit ? '1px solid #10b981' : '1px solid #e5e7eb',
            background: canSubmit ? '#10b981' : '#f3f4f6',
            color: canSubmit ? '#fff' : '#6b7280',
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
          title={canSubmit ? 'Submit Solution' : 'Run and pass all tests to submit'}
        >
          Submit Solution
        </button>
      </div>
    </div>
  );
};

const SandpackTest: React.FC<SandpackTestProps> = ({
  starterCode,
  testCode,
  framework,
  onSubmit,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const testsRootRef = useRef<HTMLDivElement>(null);

  const { template, codeFile, testFile, deps } = getSetup(framework);

  const files = useMemo<SandpackFiles>(() => {
    return {
      [codeFile]: { code: starterCode ?? '', active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
    };
  }, [starterCode, testCode, codeFile, testFile]);

  // Observe the Tests panel for updates; enable Submit only when all tests pass.
  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;

    const handleCheck = () => {
      const text = root.textContent || '';
      const { allPassed } = parseSummaryFromText(text);
      if (allPassed) {
        setCanSubmit(true);
        setIsRunning(false);
      }
    };

    const obs = new MutationObserver(() => {
      window.requestAnimationFrame(handleCheck);
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });

    // Initial clear when switching questions/frameworks
    setCanSubmit(false);
    setIsRunning(false);

    return () => obs.disconnect();
  }, [framework, starterCode, testCode]);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      // key helps reset sandpack cleanly if framework changes
      key={template}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{
        autorun: true,               // compile on load; tests will run when user clicks "Run Tests"
        initMode: 'immediate',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        showConsole: false,          // we use our own Console component below
        visibleFiles: [codeFile, testFile],
        activeFile: codeFile,
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
          {/* Left: Editor */}
          <div style={{ flex: 1 }}>
            <SandpackCodeEditor
              style={{ height: '60vh' }}
              showTabs
              showLineNumbers
              showInlineErrors
            />
          </div>

          {/* Right: Console + Tests */}
          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
            {/* Console Header + Body (dark) */}
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
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* Custom toolbar */}
            <TestToolbar
              isRunning={isRunning}
              setIsRunning={(v) => {
                // When user clicks Run, also clear submit state until new results
                if (v) setCanSubmit(false);
                setIsRunning(v);
              }}
              canSubmit={canSubmit}
              onSubmit={() => {
                const text = testsRootRef.current?.textContent || '';
                const parsed = parseSummaryFromText(text);
                onSubmit?.({ ...parsed, rawText: text });
              }}
            />

            {/* Tests panel (results UI only; built-in action buttons hidden via CSS) */}
            <div ref={testsRootRef} className="gt-tests" style={{ flex: 1, minHeight: 0 }}>
              <SandpackTests
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
