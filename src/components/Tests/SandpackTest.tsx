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

  const suitesLine = text.match(/Test suites?:([^\n]+)/i)?.[1] ?? text.match(/Test files?:([^\n]+)/i)?.[1] ?? '';
  const testsLine = text.match(/Tests?:([^\n]+)/i)?.[1] ?? '';

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
}> = ({ testsRootRef, onTestsComplete }) => {
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;

    console.log('[SandpackTest] Setting up test completion observer');

    observerRef.current?.disconnect();

    const observe = () => {
      const obs = new MutationObserver(() => {
        const text = root.textContent || '';
        
        if (!text) return;
        
        const parsed = parseSummary(text);
        
        if (parsed.ran) {
          console.log('[SandpackTest] Tests completed, calling onTestsComplete');
          onTestsComplete(text, parsed);
          obs.disconnect();
          observerRef.current = null;
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
  }, [onTestsComplete, testsRootRef]);

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

  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const [submitted, setSubmitted] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any } | null>(null);
  const [runId, setRunId] = useState(0);

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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./setupTests.ts'],
  },
});
        `.trim(),
        hidden: true,
      },
      '/setupTests.ts': {
        code: `import '@testing-library/jest-dom';`,
        hidden: true,
      },
      '/package.json': {
        code: JSON.stringify(
          {
            name: 'sandpack-tests',
            version: '1.0.0',
            private: true,
            scripts: { test: 'vitest run --reporter=basic' },
          },
          null,
          2
        ),
        hidden: true,
      },
    };
  }, [starterCode, testCode, codeFile, testFile]);

  const handleTestsComplete = (rawText: string, parsed: any) => {
    console.log('[SandpackTest] Tests completed with results:', parsed);
    setLastRawText(rawText);
    setLastParsed(parsed);

    const tests = parsed.tests || {};
    const total = typeof tests.total === 'number' ? tests.total : 0;
    const failed = typeof tests.failed === 'number' ? tests.failed : 0;

    if (parsed.ran && total > 0 && failed === 0) {
      setTestStatus('passed');
    } else {
      setTestStatus('failed');
    }
  };

  // Button action to trigger test execution
  const handleRunTests = async () => {
    console.log('[SandpackTest] Running tests...');
    setRunId(prev => prev + 1); // Increment key to re-initiate the observer
    setTestStatus('running');
    setLastRawText('');
    setLastParsed(null);

    try {
      await sandpack.runSandpack();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let testButton = null;
      let attempts = 0;
      const maxAttempts = 30; // Increased from 10
      
      while (!testButton && attempts < maxAttempts) {
        attempts++;
        console.log(`[SandpackTest] Attempt ${attempts} to find test button`);
        
        const selectors = [
          'button[title*="Run"]', 'button[aria-label*="Run"]', 'button[aria-label*="run"]', 'button[title*="run"]',
          '[data-sp-tests] button', '.sp-tests button', '.sp-test button', 'button[data-testid*="run"]',
          'button[class*="run"]', 'button[class*="test"]'
        ];
        
        for (const selector of selectors) {
          try {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
              if (btn instanceof HTMLButtonElement && !btn.disabled && btn.closest('[class*="test"], [class*="sp-"], [data-sp-tests]')) {
                testButton = btn;
                console.log('[SandpackTest] Found test button with selector:', selector);
                break;
              }
            }
            if (testButton) break;
          } catch (e) { /* Invalid selector */ }
        }
        
        if (!testButton) {
          const allButtons = document.querySelectorAll('button');
          for (const button of allButtons) {
            const hasPlayIcon = button.querySelector('svg path[d*="triangle"], svg path[d*="polygon"]');
            const hasRunText = (button.textContent || button.title || button.getAttribute('aria-label') || '').toLowerCase().includes('run');
            if ((hasPlayIcon || hasRunText) && button.closest('[class*="test"], [class*="sp-"], [data-sp-tests]') && !button.disabled) {
              testButton = button;
              console.log('[SandpackTest] Found test button by content/icon');
              break;
            }
          }
        }
        
        if (!testButton) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (testButton && testButton instanceof HTMLButtonElement) {
        console.log('[SandpackTest] Clicking test button programmatically');
        testButton.click();
        
        setTimeout(() => {
          setTestStatus(currentStatus => {
            if (currentStatus === 'running') {
              console.log('[SandpackTest] Tests seem stuck, marking as failed');
              return 'failed';
            }
            return currentStatus;
          });
        }, 25000); // Increased from 15000 to give tests more time
        
      } else {
        console.log('[SandpackTest] Could not find test button, marking as failed');
        setTestStatus('failed');
      }
      
    } catch (error) {
      console.error('[SandpackTest] Error running tests:', error);
      setTestStatus('failed');
    }
  };

  const handleSubmit = async () => {
    if (!lastParsed) {
      console.log('[SandpackTest] Cannot submit - no test results parsed');
      return;
    }

    console.log('[SandpackTest] Submitting results:', lastParsed);

    const tests = lastParsed.tests || {};
    const total = typeof tests.total === 'number' ? tests.total : undefined;
    const failed = typeof tests.failed === 'number' ? tests.failed : undefined;
    const passed = typeof tests.passed === 'number' ? tests.passed : undefined;

    let score = (total && total > 0 && failed === 0) ? 1 : 0;

    console.log('[SandpackTest] Score calculation:', { total, passed, failed, calculatedScore: score });

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

      window.dispatchEvent(
        new CustomEvent('sandpack:submitted', {
          detail: { assignmentId, questionId, score, passed, failed, total, rawText: lastRawText },
        })
      );

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

  const renderStatusMessage = () => {
    switch (testStatus) {
      case 'passed':
        return <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ All tests passed!</p>;
      case 'failed':
        return <p style={{ margin: 0, fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>❌ Some tests failed. You can submit or try again.</p>;
      case 'running':
         return <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Running tests, please wait...</p>;
      case 'idle':
      default:
        return <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Write your code, then run tests to see results</p>;
    }
  };

  const renderActionButtons = () => {
    const baseStyle: React.CSSProperties = {
      padding: '10px 20px', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600,
      fontSize: '14px', cursor: 'pointer', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      display: 'flex', alignItems: 'center', gap: '8px'
    };

    if (testStatus === 'running') {
      return (
        <button disabled style={{ ...baseStyle, backgroundColor: '#94a3b8', cursor: 'not-allowed' }}>
          <div style={{ 
            width: '16px', height: '16px', border: '2px solid #ffffff40',
            borderTop: '2px solid #ffffff', borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Running Tests...
        </button>
      );
    }
    
    if (testStatus === 'passed' || testStatus === 'failed') {
      return (
        <>
          <button onClick={handleRunTests} style={{ ...baseStyle, backgroundColor: '#64748b' }}>
            🔄 Run Again
          </button>
          <button
            onClick={handleSubmit}
            style={{ ...baseStyle, backgroundColor: testStatus === 'passed' ? '#10b981' : '#f59e0b' }}
          >
            Submit Results
          </button>
        </>
      );
    }
    
    // Idle State
    return (
      <button onClick={handleRunTests} style={{ ...baseStyle, backgroundColor: '#3b82f6' }}>
        ▶️ Run Tests
      </button>
    );
  };
  
  return (
    <>
      <div 
        style={{
          padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px'
        }}
      >
        {submitted ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>
            ✅ Submitted! Advancing to next question...
          </p>
        ) : (
          <>
            {renderStatusMessage()}
            {renderActionButtons()}
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
          <TestsAndConsole key={runId} testsRootRef={testsRootRef} onTestsComplete={handleTestsComplete} />
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
