import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
  useSandpack,
  type SandpackFiles,
  type SandpackProviderProps,
} from '@codesandbox/sandpack-react';
import { supabase } from '../../lib/supabase';

type Framework = 'react' | 'vue' | 'javascript';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | null | undefined;
  framework: Framework;
  assignmentId: string;
  questionId: string;
  isLastQuestion: boolean;
  onNext: () => void;
  onComplete: () => void;
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
          '@vue/test-utils': '^2.4.5',
          '@testing-library/vue': '^8.0.3',
          '@testing-library/dom': '^9.3.4',
          '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2',
          vitest: '^0.34.6',
        },
      };
    case 'javascript':
    default:
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
  }
};

function parseSummary(text: string) {
  const ran = /Test suites?:|Test files?:|Tests?:|No tests found/i.test(text);
  if (!ran) return { ran: false, suites: undefined, tests: undefined };

  const suitesLine =
    text.match(/Test suites?:([^\n]+)/i)?.[1] ?? text.match(/Test files?:([^\n]+)/i)?.[1] ?? '';
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

const TestsAndConsole: React.FC<{
  testsRootRef: React.RefObject<HTMLDivElement>;
  onTestsComplete: (rawText: string, parsed: any) => void;
}> = ({ testsRootRef, onTestsComplete }) => {
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;

    observerRef.current?.disconnect();

    const obs = new MutationObserver(() => {
      const text = root.textContent || '';
      if (!text) return;
      const parsed = parseSummary(text);
      if (parsed.ran) {
        onTestsComplete(text, parsed);
        obs.disconnect();
        observerRef.current = null;
      }
    });

    obs.observe(root, { childList: true, subtree: true, characterData: true });
    observerRef.current = obs;

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [onTestsComplete]);

  return (
    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests style={{ height: '100%' }} watchMode={false} showWatchButton={false} showVerboseButton={false} />
      </div>
      <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
        <SandpackConsole
          maxMessageCount={200}
          showHeader
          standalone
          style={{ height: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}
        />
      </div>
    </div>
  );
};

const SandpackTestInner: React.FC<
  SandpackTestProps & {
    template: SandpackProviderProps['template'];
    codeFile: string;
    testFile: string;
    deps: Record<string, string>;
  }
> = (props) => {
  const { starterCode, testCode, assignmentId, questionId, isLastQuestion, onNext, onComplete, template, codeFile, testFile, deps } = props;

  const [canSubmit, setCanSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any } | null>(null);

  const { sandpack } = useSandpack();
  const testsRootRef = useRef<HTMLDivElement>(null);

  const files = useMemo<SandpackFiles>(() => {
    if (!testCode) return {};
    return {
      [codeFile]: { code: starterCode ?? '', active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
      '/vitest.config.ts': {
        code: `
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] },
});
        `.trim(),
        hidden: true,
      },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': {
        code: JSON.stringify({ name: 'sandpack-tests', private: true, scripts: { test: 'vitest run --reporter=basic' } }, null, 2),
        hidden: true,
      },
    };
  }, [starterCode, testCode, codeFile, testFile]);

  const handleTestsComplete = (rawText: string, parsed: any) => {
    setLastRawText(rawText);
    setLastParsed(parsed);
    setCanSubmit(true);
    setIsRunning(false);
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    setCanSubmit(false);
    setLastRawText('');
    setLastParsed(null);
    await sandpack.runSandpack();
  };

  const handleSubmit = async () => {
    if (!lastParsed) return;

    const tests = lastParsed.tests || {};
    const total = typeof tests.total === 'number' ? tests.total : undefined;
    const failed = typeof tests.failed === 'number' ? tests.failed : undefined;
    const passed = typeof tests.passed === 'number' ? tests.passed : undefined;

    let score = 0;
    if (total && total > 0) score = failed === 0 ? 1 : 0;

    const { error: upsertError } = await supabase
      .from('test_results')
      .upsert(
        {
          assignment_id: assignmentId,
          question_id: questionId,
          score,
          passed_test_cases: passed ?? null,
          total_test_cases: total ?? null,
          stdout: lastRawText,
          stderr: '',
        },
        { onConflict: 'assignment_id,question_id' }
      );

    if (!upsertError) {
      setSubmitted(true);
      setTimeout(() => {
        if (isLastQuestion) onComplete();
        else onNext();
      }, 2000);
    }
  };

  if (!testCode) return <div>This Sandpack question is missing its test code.</div>;

  return (
    <>
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        {submitted ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: 600 }}>✅ Submitted! Advancing to next question...</p>
        ) : canSubmit ? (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: '#059669', fontWeight: 500 }}>✅ Tests completed!</p>
            <button
              onClick={handleSubmit}
              style={{
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
              }}
            >
              Submit Results
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Write your code, then run tests to see results</p>
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              style={{
                padding: '10px 20px',
                backgroundColor: isRunning ? '#94a3b8' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isRunning ? (
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              ) : (
                'Run Tests'
              )}
            </button>
          </>
        )}
      </div>

      <SandpackLayout style={{ height: '600px', border: '1px solid #e5e7eb' }}>
        <SandpackCodeEditor showLineNumbers showTabs wrapContent />
        <TestsAndConsole testsRootRef={testsRootRef} onTestsComplete={handleTestsComplete} />
      </SandpackLayout>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
};

export const SandpackTestWrapper: React.FC<SandpackTestProps> = (props) => {
  const { starterCode, framework, testCode } = props;
  const { template, codeFile, testFile, deps } = getSetup(framework);

  if (!starterCode || !testCode) return <div>Missing starter code or test code for this question.</div>;

  return (
    <SandpackProvider
      template={template}
      files={{}}
      customSetup={{ dependencies: deps }}
      options={{ autorun: false, activeFile: codeFile }}
    >
      <SandpackTestInner {...props} template={template} codeFile={codeFile} testFile={testFile} deps={deps} />
    </SandpackProvider>
  );
};

export default SandpackTestWrapper;

