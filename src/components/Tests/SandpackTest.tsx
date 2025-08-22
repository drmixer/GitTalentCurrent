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

// This interface is now defined outside to be shared
interface SandpackTestInnerProps extends SandpackTestProps {
  template: SandpackProviderProps['template'];
  codeFile: string;
  testFile: string;
  deps: Record<string, string>;
  shouldAutorun: boolean;
  onRerun: () => void;
}

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
  if (!ran) return { ran: false };
  const suitesLine = text.match(/Test suites?:([^\n]+)/i)?.[1] ?? text.match(/Test files?:([^\n]+)/i)?.[1] ?? '';
  const testsLine = text.match(/Tests?:([^\n]+)/i)?.[1] ?? '';
  const num = (re: RegExp, s: string) => Number(s.match(re)?.[1]);
  const tests = {
    passed: num(/(\d+)\s*passed/i, testsLine),
    failed: num(/(\d+)\s*failed/i, testsLine),
    total: num(/(\d+)\s*total/i, testsLine),
  };
  return { ran, tests };
}

const TestsAndConsole: React.FC<{
  testsRootRef: React.RefObject<HTMLDivElement>;
  onTestsComplete: (rawText: string, parsed: any) => void;
  isRunning: boolean;
}> = ({ testsRootRef, onTestsComplete, isRunning }) => {
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const root = testsRootRef.current;
    if (!isRunning || !root) {
      observerRef.current?.disconnect();
      return;
    }
    const obs = new MutationObserver(() => {
      const text = root.textContent || '';
      if (!text) return;
      const parsed = parseSummary(text);
      if (parsed.ran) {
        onTestsComplete(text, parsed);
      }
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    observerRef.current = obs;
    return () => {
      observerRef.current?.disconnect();
    };
  }, [isRunning, onTestsComplete, testsRootRef]);

  return (
    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests style={{ height: '100%' }} />
      </div>
      <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
        <SandpackConsole />
      </div>
    </div>
  );
};

const SandpackTestInner: React.FC<SandpackTestInnerProps> = (props) => {
  const {
    starterCode,
    testCode,
    assignmentId,
    questionId,
    isLastQuestion,
    onNext,
    onComplete,
    codeFile,
    shouldAutorun,
    onRerun,
  } = props;

  const [canSubmit, setCanSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<any>(null);

  const { sandpack } = useSandpack();
  const testsRootRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleTestsComplete = (rawText: string, parsed: any) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLastRawText(rawText);
    setLastParsed(parsed);
    setCanSubmit(true);
    setIsRunning(false);
  };
  
  const handleRunTests = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsRunning(true);
    setCanSubmit(false);
    setLastRawText('');
    setLastParsed(null);
    
    try {
      await sandpack.runSandpack();
      await new Promise(resolve => setTimeout(resolve, 2000));
      let testButton: HTMLButtonElement | null = null;
      let attempts = 0;
      while (!testButton && attempts < 10) {
        attempts++;
        testButton = document.querySelector('.sp-tests button');
        if (!testButton) await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (testButton) {
        testButton.click();
        timeoutRef.current = setTimeout(() => {
          setIsRunning(current => {
            if (current) console.log('[SandpackTest] Tests seem stuck, resetting state');
            return false;
          });
        }, 15000);
      } else {
        console.log('[SandpackTest] Could not find test button after all attempts');
        setIsRunning(false);
      }
    } catch (error) {
      console.error('[SandpackTest] Error running tests:', error);
      setIsRunning(false);
    }
  };

  // If the parent requests an autorun (after a reset), trigger it.
  useEffect(() => {
    if (shouldAutorun) {
      // Short delay to ensure the new Sandpack instance is fully ready.
      setTimeout(() => {
        handleRunTests();
      }, 100);
    }
  }, [shouldAutorun]);

  const handleSubmit = async () => {
    if (!lastParsed) return;
    const { tests } = lastParsed;
    const score = (tests.total > 0 && tests.failed === 0) ? 1 : 0;
    try {
      await supabase.from('test_results').upsert({
        assignment_id: assignmentId,
        question_id: questionId,
        score,
        passed_test_cases: tests.passed ?? null,
        total_test_cases: tests.total ?? null,
        stdout: lastRawText,
      }, { onConflict: 'assignment_id,question_id' });
      setSubmitted(true);
      setTimeout(() => {
        if (isLastQuestion) onComplete();
        else onNext();
      }, 2000);
    } catch (err) {
      alert('Unexpected error during submit.');
    }
  };

  if (!testCode) return <div>Missing test code.</div>;

  return (
    <>
      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        {submitted ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ Submitted! Advancing...</p>
        ) : canSubmit ? (
          (() => {
            const tests = lastParsed?.tests;
            const testsFailed = tests?.failed > 0;
            const allTestsPassed = tests && tests.total > 0 && tests.failed === 0;
            return (
              <>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: testsFailed ? '#ef4444' : '#10b981' }}>
                  {allTestsPassed ? `✅ All tests passed!` : testsFailed ? `❌ ${tests.failed} of ${tests.total} failed.` : 'ℹ️ Tests completed.'}
                </p>
                <button onClick={onRerun} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  Rerun Tests
                </button>
                <button onClick={handleSubmit} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  Submit Results
                </button>
              </>
            );
          })()
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Write your code, then run tests.</p>
            <button onClick={handleRunTests} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: isRunning ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isRunning ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #ffffff40', borderTop: '2px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Running...
                </>
              ) : '▶️ Run Tests'}
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      <div className="gt-sp">
        <SandpackLayout>
          <SandpackCodeEditor style={{ height: '70vh' }} showTabs showLineNumbers showInlineErrors />
          <TestsAndConsole testsRootRef={testsRootRef} onTestsComplete={handleTestsComplete} isRunning={isRunning} />
        </SandpackLayout>
      </div>
    </>
  );
};

const SandpackTest: React.FC<SandpackTestProps> = (props) => {
  const { template, codeFile, testFile, deps } = getSetup(props.framework);
  const [runState, setRunState] = useState({ key: 0, shouldAutorun: false });

  const handleRerun = () => {
    setRunState(s => ({ key: s.key + 1, shouldAutorun: true }));
  };

  const files = useMemo<SandpackFiles>(() => {
    if (!props.testCode) return {};
    return {
      [codeFile]: { code: props.starterCode ?? '', active: true },
      [testFile]: { code: props.testCode ?? '' },
      '/vitest.config.ts': { code: `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`, hidden: true },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': { code: JSON.stringify({ name: 'sandpack-tests', scripts: { test: 'vitest run --reporter=basic' } }, null, 2), hidden: true },
    };
  }, [props.starterCode, props.testCode, codeFile, testFile]);
  
  return (
    <SandpackProvider
      key={`${props.questionId}-${runState.key}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{ autorun: false, initMode: 'immediate' }}
    >
      <SandpackTestInner
        {...props}
        template={template}
        codeFile={codeFile}
        testFile={testFile}
        deps={deps}
        shouldAutorun={runState.shouldAutorun}
        onRerun={handleRerun}
      />
    </SandpackProvider>
  );
};

export default SandpackTest;
