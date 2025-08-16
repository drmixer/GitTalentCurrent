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

type Framework = 'react' | 'react-js' | 'vue' | 'vanilla';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | null | undefined;
  framework: Framework; // react | react-js | vue | vanilla
  onSubmit?: (result: {
    allPassed: boolean;
    suites: { passed: number; total: number } | null;
    tests: { passed: number; total: number } | null;
    rawText: string;
  }) => void;
}

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
          vitest: '^0.34.6',
        },
      };
    case 'react-js':
      return {
        template: 'react' as SandpackProviderProps['template'],
        codeFile: '/src/App.jsx',
        testFile: '/src/App.test.jsx',
        deps: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1',
          '@testing-library/user-event': '^14.5.2',
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
          vitest: '^0.34.6',
        },
      };
    default:
      return {
        template: 'react-ts' as SandpackProviderProps['template'],
        codeFile: '/src/App.tsx',
        testFile: '/src/App.test.tsx',
        deps: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1',
          '@testing-library/user-event': '^14.5.2',
          vitest: '^0.34.6',
        },
      };
  }
};

function parseSummaryFromText(text: string) {
  const suitesRe = /Test suites:\s*(\d+)\s*passed,\s*(\d+)\s*total/i;
  const testsRe = /Tests:\s*(\d+)\s*passed,\s*(\d+)\s*total/i;

  const suitesMatch = text.match(suitesRe);
  const testsMatch = text.match(testsRe);

  const suites =
    suitesMatch && suitesMatch.length >= 3
      ? { passed: Number(suitesMatch[1]), total: Number(suitesMatch[2]) }
      : null;

  const tests =
    testsMatch && testsMatch.length >= 3
      ? { passed: Number(testsMatch[1]), total: Number(testsMatch[2]) }
      : null;

  const allPassed =
    (!!suites ? suites.passed === suites.total && suites.total > 0 : true) &&
    (!!tests ? tests.passed === tests.total && tests.total > 0 : true) &&
    // guard: avoid the “ready to run” state
    /Pass/i.test(text) && !/Fail/i.test(text);

  return { allPassed, suites, tests };
}

const RUN_RESET_FALLBACK_MS = 4000;

const TestToolbar: React.FC<{
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  canSubmit: boolean;
  onSubmit?: () => void;
  testsRootRef: React.RefObject<HTMLDivElement>;
}> = ({ isRunning, setIsRunning, canSubmit, onSubmit, testsRootRef }) => {
  const { sandpack } = useSandpack();
  const timerRef = useRef<number | null>(null);

  const clickBuiltInRun = () => {
    const root = testsRootRef.current;
    if (!root) return false;
    // Try several likely selectors; we hide these with CSS but can still click programmatically.
    const candidates = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        `
        [class*="sp-test-actions"] button,
        [data-testid="test-actions"] button,
        button`
      )
    ).filter((btn) => !btn.disabled && btn.offsetParent !== null);
    const runBtn = candidates[0];
    if (runBtn) {
      runBtn.click();
      return true;
    }
    return false;
  };

  const handleRun = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(true);

    // Prefer clicking the built-in Run button; fallback to bundler run.
    const didClick = clickBuiltInRun();
    if (!didClick) {
      sandpack.runSandpack();
    }

    // Fallback: ensure the button doesn’t get stuck forever.
    timerRef.current = window.setTimeout(() => {
      setIsRunning(false);
      timerRef.current = null;
    }, RUN_RESET_FALLBACK_MS);
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

const SandpackTest: React.FC<SandpackTestProps> = ({ starterCode, testCode, framework, onSubmit }) => {
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

  // Watch the Tests panel text and enable submit when everything passes.
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
      // Debounce a tiny bit
      window.requestAnimationFrame(handleCheck);
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, []);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{
        autorun: true,
        initMode: 'immediate',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        showConsole: false,
        visibleFiles: [codeFile, testFile],
        activeFile: codeFile,
      }}
    >
      {/* Hide built-in Test action buttons inside the Tests panel only */}
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
            {/* Console header + body (dark), with a static helper text */}
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
              <div style={{ height: 140, background: '#0f172a', position: 'relative' }}>
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
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: 12,
                }}>
                  Click "Run Tests" to see output...
                </div>
              </div>
            </div>

            {/* Custom toolbar */}
            <TestToolbar
              isRunning={isRunning}
              setIsRunning={setIsRunning}
              canSubmit={canSubmit}
              onSubmit={() => {
                const text = testsRootRef.current?.textContent || '';
                const parsed = parseSummaryFromText(text);
                onSubmit?.({ ...parsed, rawText: text });
              }}
              testsRootRef={testsRootRef}
            />

            {/* Tests (results only; built-in buttons hidden) */}
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
