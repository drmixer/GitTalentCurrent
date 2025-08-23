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
    // Other frameworks remain the same
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
  if (!ran) {
    return { ran: false, suites: undefined, tests: undefined };
  }
  const testsLine = text.match(/Tests?:([^\n]+)/i)?.[1] ?? '';
  const num = (re: RegExp, s: string) => {
    const m = s.match(re);
    return m ? Number(m[1]) : undefined;
  };
  const tests = testsLine
    ? {
        passed: num(/(\d+)\s*passed/i, testsLine),
        failed: num(/(\d+)\s*failed/i, testsLine),
        total: num(/(\d+)\s*total/i, testsLine),
      }
    : undefined;
  return { ran, suites: undefined, tests };
}

// THE ONLY SIGNIFICANT CHANGE IS IN THIS COMPONENT
const TestsAndConsole: React.FC<{
  testsRootRef: React.RefObject<HTMLDivElement>;
  onTestsComplete: (rawText: string, parsed: any) => void;
  isRunning: boolean; // We need this to know WHEN to listen
}> = ({ testsRootRef, onTestsComplete, isRunning }) => {
  useEffect(() => {
    const root = testsRootRef.current;
    if (!isRunning || !root) {
      return;
    }

    console.log('[SandpackTest] Setting up test completion observer');
    const observer = new MutationObserver(() => {
      const text = root.textContent || '';
      if (!text) return;
      
      const parsed = parseSummary(text);
      
      if (parsed.ran) {
        console.log('[SandpackTest] Tests completed, calling onTestsComplete');
        onTestsComplete(text, parsed);
        // We disconnect here because the test run is over. 
        // A new one will be created on the next run when isRunning becomes true again.
        observer.disconnect(); 
      }
    });
      
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      console.log('[SandpackTest] Cleaning up test completion observer');
      observer.disconnect();
    };
  }, [isRunning, onTestsComplete, testsRootRef]);

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
        <SandpackConsole maxMessageCount={200} showHeader standalone style={{ height: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12, }} />
      </div>
    </div>
  );
};

// This component uses your original, working `handleRunTests` logic
const SandpackTestInner: React.FC<
  SandpackTestProps & {
    template: SandpackProviderProps['template'];
    codeFile: string;
    testFile: string;
    deps: Record<string, string>;
  }
> = (props) => {
  const {
    starterCode, testCode, assignmentId, questionId,
    isLastQuestion, onNext, onComplete, codeFile, testFile,
  } = props;

  const [canSubmit, setCanSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any } | null>(null);

  const { sandpack } = useSandpack();
  const testsRootRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const files = useMemo<SandpackFiles>(() => {
    if (!testCode) return {};
    return {
      [codeFile]: { code: starterCode ?? '', active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
      '/vitest.config.ts': { code: `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`, hidden: true },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': { code: JSON.stringify({ name: 'sandpack-tests', version: '1.0.0', private: true, scripts: { test: 'vitest run --reporter=basic' }, }, null, 2 ), hidden: true, },
    };
  }, [starterCode, testCode, codeFile, testFile]);

  const handleTestsComplete = (rawText: string, parsed: any) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    console.log('[SandpackTest] Tests completed with results:', parsed);
    setLastRawText(rawText);
    setLastParsed(parsed);
    setCanSubmit(true);
    setIsRunning(false);
  };

  const handleRunTests = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    console.log('[SandpackTest] Running tests...');
    setIsRunning(true);
    setCanSubmit(false);
    setLastRawText('');
    setLastParsed(null);

    try {
      // This command resets the Sandpack client to ensure a fresh state for every run
      await sandpack.runSandpack();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Increased delay for stability
      
      let testButton: HTMLButtonElement | null = null;
      let attempts = 0;
      while (!testButton && attempts < 10) {
        attempts++;
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          const title = btn.title?.toLowerCase() || '';
          const inTestArea = btn.closest('[class*="test"], [data-sp-tests]');
          if (inTestArea && (text.includes('run') || title.includes('run'))) {
            testButton = btn;
            break;
          }
        }
        if (testButton) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (testButton) {
        console.log('[SandpackTest] Found test button, clicking...');
        testButton.click();
        
        timeoutRef.current = setTimeout(() => {
            setIsRunning(current => {
              if (current) {
                  console.log('[SandpackTest] Test run timed out.');
                  alert("The test runner timed out. Your code might have an infinite loop.");
                  return false;
              }
              return current;
            });
          }, 20000);
      } else {
        console.log('[SandpackTest] Could not find test button.');
        alert("Could not initialize the test runner. Please try refreshing the page.");
        setIsRunning(false);
      }
    } catch (error) {
      console.error('[SandpackTest] Error running tests:', error);
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!lastParsed) return;
    const { tests } = lastParsed;
    const score = (tests.total > 0 && tests.failed === 0) ? 1 : 0;
    try {
      await supabase.from('test_results').upsert({ assignment_id: assignmentId, question_id: questionId, score, passed_test_cases: tests.passed ?? null, total_test_cases: tests.total ?? null, stdout: lastRawText, stderr: '', }, { onConflict: 'assignment_id,question_id' });
      setSubmitted(true);
      setTimeout(() => { isLastQuestion ? onComplete() : onNext(); }, 2000);
    } catch (err) {
      alert('Unexpected error during submission.');
    }
  };

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <>
      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        {submitted ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ Submitted! Advancing...</p>
        ) : canSubmit ? (
          <>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: lastParsed?.tests?.failed > 0 ? '#ef4444' : '#10b981' }}>
              {lastParsed?.tests?.failed > 0 ? `❌ ${lastParsed.tests.failed} of ${lastParsed.tests.total} failed.` : '✅ All tests passed!'}
            </p>
            <button onClick={handleRunTests} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
              Rerun Tests
            </button>
            <button onClick={handleSubmit} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
              Submit Results
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Write your code, then run tests to see results</p>
            <button onClick={handleRunTests} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: isRunning ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isRunning ? ( <><div style={{ width: '16px', height: '16px', border: '2px solid #ffffff40', borderTop: '2px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Running Tests...</> ) : ( '▶️ Run Tests' )}
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

  const files = useMemo<SandpackFiles>(() => {
    if (!props.testCode) return {};
    return {
      [codeFile]: { code: props.starterCode ?? '', active: true },
      [testFile]: { code: props.testCode ?? '', hidden: false },
      '/vitest.config.ts': { code: `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`, hidden: true },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': { code: JSON.stringify({ name: 'sandpack-tests', private: true, scripts: { test: 'vitest run --reporter=basic' } }, null, 2 ), hidden: true, },
    };
  }, [props.starterCode, props.testCode, codeFile, testFile]);

  if (!props.testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      key={`${template}-${codeFile}-${testFile}-${props.questionId}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{ autorun: false, initMode: 'immediate', showTabs: true, showNavigator: false, showInlineErrors: true, showErrorOverlay: true, visibleFiles: [codeFile, testFile], activeFile: codeFile, }}
    >
      <SandpackTestInner {...props} template={template} codeFile={codeFile} testFile={testFile} deps={deps} />
    </SandpackProvider>
  );
};

export default SandpackTest;
