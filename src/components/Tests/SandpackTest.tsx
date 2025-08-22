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
  console.log('[SandpackTest] Parsing test output:', text);
  
  const ran = /Test suites?:|Test files?:|Tests?:|No tests found/i.test(text);
  
  if (!ran) {
    console.log('[SandpackTest] No test indicators found in output');
    return { ran: false, suites: undefined, tests: undefined };
  }

  const suitesLine = text.match(/Test (?:suites|files)?:(.*?)(?=Tests:|$)/is)?.[1] ?? '';
  const testsLine = text.match(/Tests?:(.*)/is)?.[1] ?? '';

  console.log('[SandpackTest] Extracted lines - suites:', suitesLine, 'tests:', testsLine);

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

  const result = { ran, suites, tests };
  console.log('[SandpackTest] Parsed result:', result);
  return result;
}

const TestsAndConsole: React.FC<{
  testsRootRef: React.RefObject<HTMLDivElement>;
  onTestsComplete: (rawText: string, parsed: any) => void;
  isRunning: boolean;
}> = ({ testsRootRef, onTestsComplete, isRunning }) => {
  const observerRef = useRef<MutationObserver | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (isRunning) {
      hasCompletedRef.current = false;
    }
  }, [isRunning]);

  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;

    console.log('[SandpackTest] Setting up test completion observer');

    observerRef.current?.disconnect();

    const observe = () => {
      const obs = new MutationObserver(() => {
        const text = root.textContent || '';
        if (!text || hasCompletedRef.current) return;
        
        const parsed = parseSummary(text);
        
        if (parsed.ran) {
          console.log('[SandpackTest] Tests completed, calling onTestsComplete');
          hasCompletedRef.current = true;
          onTestsComplete(text, parsed);
          // Do not disconnect, let the isRunning flag handle resets.
        }
      });
      
      obs.observe(root, { 
        childList: true, 
        subtree: true, 
        characterData: true
      });
      observerRef.current = obs;
    };

    observe();

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [onTestsComplete]);

  return (
    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests 
          style={{ height: '100%' }} 
          watchMode={false} 
          showWatchButton={false} 
          showVerboseButton={false}
          hideTestsAndSupressLogs={false}
        />
      </div>

      <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
        <SandpackConsole
          maxMessageCount={200}
          showHeader
          standalone
          style={{
            height: '100%',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
          }}
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
  const {
    starterCode,
    testCode,
    assignmentId,
    questionId,
    isLastQuestion,
    onNext,
    onComplete,
    codeFile,
    testFile,
  } = props;

  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any } | null>(null);
  const [shouldRunTests, setShouldRunTests] = useState(false);
  
  const testRunIdRef = useRef(0);
  const { sandpack } = useSandpack();
  const testsRootRef = useRef<HTMLDivElement>(null);
  
  const testsPassed = useMemo(() => {
    if (!lastParsed || !lastParsed.tests) return false;
    const { failed, total } = lastParsed.tests;
    if (!total || total === 0) return false;
    // If 'failed' is undefined or 0, it means no tests failed.
    return !failed;
  }, [lastParsed]);

  const handleTestsComplete = (rawText: string, parsed: any) => {
    console.log('[SandpackTest] handleTestsComplete called with results:', parsed);
    setLastRawText(rawText);
    setLastParsed(parsed);
    setIsRunning(false);
  };

  const handleRunTests = () => {
    console.log('[SandpackTest] Queuing test run...');
    setIsRunning(true);
    setLastParsed(null);
    setShouldRunTests(true);
  };
  
  useEffect(() => {
    if (!shouldRunTests) return;

    const run = async () => {
      console.log('[SandpackTest] Running tests...');
      const currentRunId = ++testRunIdRef.current;
      
      try {
        await sandpack.runSandpack();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let testButton = null;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!testButton && attempts < maxAttempts) {
          attempts++;
          testButton = document.querySelector('.sp-tests button[title*="Run"], .sp-tests button[aria-label*="Run"]');
          if (!testButton) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (testButton && testButton instanceof HTMLButtonElement) {
          console.log('[SandpackTest] Clicking test button programmatically');
          testButton.click();
          
          setTimeout(() => {
            if (testRunIdRef.current === currentRunId && isRunning) {
              console.log('[SandpackTest] Tests seem stuck, resetting state');
              setIsRunning(false);
            }
          }, 15000);
          
        } else {
          console.log('[SandpackTest] Could not find test button, resetting state');
          setIsRunning(false);
        }
        
      } catch (error) {
        console.error('[SandpackTest] Error running tests:', error);
        setIsRunning(false);
      } finally {
        setShouldRunTests(false);
      }
    };

    run();
  }, [shouldRunTests, sandpack, isRunning]);

  const handleSubmit = async () => {
    if (!lastParsed) {
      console.log('[SandpackTest] Cannot submit - no test results parsed');
      return;
    }

    console.log('[SandpackTest] Submitting results:', lastParsed);

    const score = testsPassed ? 1 : 0;
    const { passed, total } = lastParsed.tests || {};

    console.log('[SandpackTest] Score calculation:', {
      total,
      passed,
      testsPassed,
      calculatedScore: score
    });

    try {
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

      if (upsertError) {
        console.error('[SandpackTest] submit upsert error', upsertError);
        alert('Failed to submit results. Please try again.');
        return;
      }

      console.log('[SandpackTest] Successfully submitted results with score:', score);
      setSubmitted(true);

      setTimeout(() => {
        console.log('[SandpackTest] Advancing to next question/completion');
        if (isLastQuestion) {
          onComplete();
        } else {
          onNext();
        }
      }, 2000);

    } catch (err) {
      console.error('[SandpackTest] submit exception', err);
      alert('Unexpected error during submit.');
    }
  };

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  const showResults = !!lastParsed && !isRunning;

  return (
    <>
      <div 
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        {submitted ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>
            ✅ Submitted! Advancing to next question...
          </p>
        ) : showResults ? (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: testsPassed ? '#059669' : '#ef4444', fontWeight: '500' }}>
              {testsPassed
                ? '✅ All tests passed! You can submit your answer or refine your code.'
                : '❌ Some tests failed. You can fix your code and rerun, or submit your current attempt.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={handleRunTests}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}
              >
                🔄 Rerun Tests
              </button>
              <button
                onClick={handleSubmit}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}
              >
                Submit Results
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
              Write your code, then run tests to see results
            </p>
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              style={{
                padding: '10px 20px',
                backgroundColor: isRunning ? '#94a3b8' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isRunning ? (
                <>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Running Tests...
                </>
              ) : (
                '▶️ Run Tests'
              )}
            </button>
          </>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      <div className="gt-sp">
        <SandpackLayout>
          <SandpackCodeEditor style={{ height: '70vh' }} showTabs showLineNumbers showInlineErrors />
          <TestsAndConsole 
            testsRootRef={testsRootRef} 
            onTestsComplete={handleTestsComplete}
            isRunning={isRunning}
          />
        </SandpackLayout>
      </div>
    </>
  );
};

const SandpackTest: React.FC<SandpackTestProps> = (props) => {
  const { template, codeFile, testFile, deps } = getSetup(props.framework);

  if (!props.testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      key={`${props.framework}-${props.questionId}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={{
        [codeFile]: { code: props.starterCode ?? '', active: true },
        [testFile]: { code: props.testCode ?? '', hidden: false },
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
          code: JSON.stringify(
            { name: 'sandpack-tests', private: true, scripts: { test: 'vitest run --reporter=basic' } },
            null,
            2
          ),
          hidden: true,
        },
      }}
      options={{
        autorun: false,
        initMode: 'immediate',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        visibleFiles: [codeFile, testFile],
        activeFile: codeFile,
      }}
    >
      <SandpackTestInner {...props} template={template} codeFile={codeFile} testFile={testFile} deps={deps} />
    </SandpackProvider>
  );
};

export default SandpackTest;
