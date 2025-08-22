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

// Prop interfaces defined for clarity
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

interface SandpackTestInnerProps extends SandpackTestProps {
  wasTriggeredByRerun: boolean;
  onRerun: (currentCode: string) => void;
  codeFile: string;
}

const getSetup = (framework: Framework) => {
  switch (framework) {
    case 'react':
      return {
        template: 'react-ts' as SandpackProviderProps['template'],
        codeFile: '/src/App.tsx',
        testFile: '/src/App.test.tsx',
        deps: {
          react: '^18.2.0', 'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1', '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2', vitest: '^0.34.6',
        },
      };
    // ... other frameworks
    default:
      return {
        template: 'vanilla-ts' as SandpackProviderProps['template'],
        codeFile: '/src/index.ts', testFile: '/src/index.test.ts',
        deps: {
          '@testing-library/dom': '^9.3.4', '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2', vitest: '^0.34.6',
        },
      };
  }
};

function parseSummary(text: string) {
  const ran = /Test suites?:|Test files?:|Tests?:|No tests found/i.test(text);
  if (!ran) return { ran: false };
  const testsLine = text.match(/Tests?:([^\n]+)/i)?.[1] ?? '';
  const num = (re: RegExp, s: string) => s.match(re) ? Number(s.match(re)?.[1]) : undefined;
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
    return () => { observerRef.current?.disconnect(); };
  }, [isRunning, onTestsComplete, testsRootRef]);

  return (
    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests style={{ height: '100%' }} watchMode={false} showWatchButton={false} showVerboseButton={false} />
      </div>
      <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
        <SandpackConsole maxMessageCount={200} showHeader standalone style={{ height: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}/>
      </div>
    </div>
  );
};

const SandpackTestInner: React.FC<SandpackTestInnerProps> = (props) => {
  const {
    assignmentId, questionId, isLastQuestion, onNext, onComplete,
    testCode, wasTriggeredByRerun, onRerun, codeFile,
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
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);
  
  const handleRunTests = async () => {
    console.log('[SandpackTest] Running tests...');
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
        console.log(`[SandpackTest] Attempt ${attempts} to find test button`);
        testButton = document.querySelector('.sp-tests button, button[title*="Run tests"]');
        if (!testButton) await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (testButton) {
        console.log('[SandpackTest] Found test button, clicking...');
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

  const handleTestsComplete = (rawText: string, parsed: any) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    console.log('[SandpackTest] Tests completed with results:', parsed);
    setLastRawText(rawText);
    setLastParsed(parsed);
    setCanSubmit(true);
    setIsRunning(false);
  };

  useEffect(() => {
    if (wasTriggeredByRerun) {
      setTimeout(() => handleRunTests(), 100);
    }
  }, []);

  const handleSubmit = async () => {
    if (!lastParsed) return;
    const { tests } = lastParsed;
    const score = (tests.total > 0 && tests.failed === 0) ? 1 : 0;
    try {
      await supabase.from('test_results').upsert({
        assignment_id: assignmentId, question_id: questionId, score,
        passed_test_cases: tests.passed ?? null, total_test_cases: tests.total ?? null,
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

  if (!testCode) return <div>Missing test code for this question.</div>;

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
                  {allTestsPassed ? `✅ All tests passed!` : testsFailed ? `❌ ${tests.failed ?? 0} of ${tests.total ?? 0} failed.` : 'ℹ️ Tests completed.'}
                </p>
                <button onClick={() => onRerun(sandpack.files[codeFile].code)} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
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
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Write your code, then run the tests.</p>
            <button onClick={handleRunTests} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: isRunning ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isRunning ? (
                <><div style={{ width: '16px', height: '16px', border: '2px solid #ffffff40', borderTop: '2px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Running Tests...</>
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
  
  const [runState, setRunState] = useState({ key: 0, wasTriggeredByRerun: false });
  const [currentCode, setCurrentCode] = useState(props.starterCode);
  const [codeToResetTo, setCodeToResetTo] = useState<string | null>(null);

  useEffect(() => {
    setCurrentCode(props.starterCode);
    setRunState({ key: 0, wasTriggeredByRerun: false });
  }, [props.questionId, props.starterCode]);

  // This effect orchestrates the reset to prevent race conditions.
  useEffect(() => {
    if (codeToResetTo !== null) {
      setCurrentCode(codeToResetTo); // 1. Set the new code
      setRunState(s => ({ key: s.key + 1, wasTriggeredByRerun: true })); // 2. Trigger re-key
      setCodeToResetTo(null); // 3. Reset the trigger
    }
  }, [codeToResetTo]);

  // The rerun handler now just sets a trigger state.
  const handleRerun = (latestCode: string) => {
    setCodeToResetTo(latestCode);
  };

  const files = useMemo<SandpackFiles>(() => {
    if (!props.testCode) return {};
    return {
      [codeFile]: { code: currentCode ?? '', active: true },
      [testFile]: { code: props.testCode ?? '' },
      '/vitest.config.ts': { code: `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`, hidden: true },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': {
        code: JSON.stringify({
          name: 'sandpack-tests', version: '1.0.0', private: true,
          scripts: { test: 'vitest run --reporter=basic' },
        }, null, 2),
        hidden: true,
      },
    };
  }, [currentCode, props.testCode, codeFile, testFile]);
  
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
        wasTriggeredByRerun={runState.wasTriggeredByRerun}
        onRerun={handleRerun}
        codeFile={codeFile}
      />
    </SandpackProvider>
  );
};

export default SandpackTest;
