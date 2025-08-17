import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
} from '@codesandbox/sandpack-react';
import type { SandpackFiles, SandpackProviderProps } from '@codesandbox/sandpack-react';

type Framework = 'react' | 'vue' | 'vanilla';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | null | undefined;
  framework: Framework; // react (TS), vue (Vue 3), vanilla (TS)
  onSubmit?: (result: {
    ran: boolean;
    rawText: string;
    suites?: { passed?: number; failed?: number; total?: number };
    tests?: { passed?: number; failed?: number; total?: number };
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

// Parse a jest-style summary. We only need to know a run happened.
function parseSummary(text: string) {
  const ran = /Test suites?:|Tests?:|No tests found/i.test(text);

  const suitesLine = text.match(/Test suites?:([^\n]+)/i)?.[1] ?? '';
  const testsLine = text.match(/Tests?:([^\n]+)/i)?.[1] ?? '';

  const num = (re: RegExp, s: string) => {
    const m = s.match(re);
    return m ? Number(m[1]) : undefined;
  };

  const suites = suitesLine
    ? {
        passed: num(/(\d+)\s*passed/i, suitesLine),
        failed: num(/(\d+)\s*failed/i, suitesLine),
        total: num(/(\d+)\s*total/i, suitesLine),
      }
    : undefined;

  const tests = testsLine
    ? {
        passed: num(/(\d+)\s*passed/i, testsLine),
        failed: num(/(\d+)\s*failed/i, testsLine),
        total: num(/(\d+)\s*total/i, testsLine),
      }
    : undefined;

  return { ran, suites, tests };
}

const SandpackTest: React.FC<SandpackTestProps> = ({ starterCode, testCode, framework, onSubmit }) => {
  const { template, codeFile, testFile, deps } = getSetup(framework);

  const [canSubmit, setCanSubmit] = useState(false);
  const testsRootRef = useRef<HTMLDivElement>(null);
  const didEnableSubmitRef = useRef(false); // prevents repeated state churn
  const observerRef = useRef<MutationObserver | null>(null);

  const files = useMemo<SandpackFiles>(() => {
    if (!testCode) return {};
    return {
      [codeFile]: { code: starterCode ?? '', active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
    };
  }, [starterCode, testCode, codeFile, testFile]);

  // Watch for the first completed test run, then disconnect the observer.
  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;

    // Reset state for this question/load
    setCanSubmit(false);
    didEnableSubmitRef.current = false;

    const check = () => {
      if (didEnableSubmitRef.current) return;
      const text = root.textContent || '';
      if (!text) return;
      const { ran } = parseSummary(text);
      if (ran) {
        didEnableSubmitRef.current = true;
        setCanSubmit(true);
        // Disconnect to stop further DOM churn and console spam
        observerRef.current?.disconnect();
        observerRef.current = null;
      }
    };

    const obs = new MutationObserver(() => {
      // Throttle to next frame
      window.requestAnimationFrame(check);
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    observerRef.current = obs;

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [framework, codeFile, testFile, starterCode, testCode]);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      key={`${template}-${codeFile}-${testFile}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{
        autorun: false,           // Only run when user clicks Run in the Tests panel
        initMode: 'immediate',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        visibleFiles: [codeFile, testFile],
        activeFile: codeFile,
      }}
    >
      <SandpackLayout>
        {/* Left: Editor */}
        <SandpackCodeEditor style={{ height: '70vh' }} showTabs showLineNumbers showInlineErrors />

        {/* Right: Tests + Console + Submit */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
          {/* Submit bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid #e5e7eb',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontSize: 13, color: '#475569' }}>
              {canSubmit ? 'Run complete. You can submit.' : 'Click Run in the Tests panel to enable Submit.'}
            </div>
            <button
              onClick={() => {
                const rawText = testsRootRef.current?.textContent || '';
                const parsed = parseSummary(rawText);
                onSubmit?.({ rawText, ...parsed });
              }}
              disabled={!canSubmit}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: canSubmit ? '1px solid #10b981' : '1px solid #cbd5e1',
                background: canSubmit ? '#10b981' : '#e2e8f0',
                color: canSubmit ? '#fff' : '#64748b',
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              title={canSubmit ? 'Submit Solution' : 'Run tests first'}
            >
              Submit
            </button>
          </div>

          {/* Tests panel; disable watch mode for stability/no re-runs */}
          <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
            <SandpackTests
              style={{ height: '100%' }}
              watchMode={false}
              showWatchButton={false}
              showVerboseButton={false}
            />
          </div>

          {/* Console */}
          <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
            <SandpackConsole
              maxMessageCount={200}
              showHeader
              standalone
              style={{
                height: '100%',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
              }}
            />
          </div>
        </div>
      </SandpackLayout>
    </SandpackProvider>
  );
};

export default SandpackTest;
