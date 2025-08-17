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

  // Flow control from parent
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

// Parse a jest/vitest style summary so we can enable Submit after any run.
function parseSummary(text: string) {
  const ran = /Test suites?:|Test files?:|Tests?:|No tests found/i.test(text);

  const suitesLine =
    text.match(/Test suites?:([^\n]+)/i)?.[1] ??
    text.match(/Test files?:([^\n]+)/i)?.[1] ??
    '';
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

const Toolbar: React.FC<{
  isRunning: boolean;
  canSubmit: boolean;
  submitted: boolean;
  onRun: () => void;
  onSubmit: () => void;
}> = ({ isRunning, canSubmit, submitted, onRun, onSubmit }) => {
  return (
    <div
      className="gt-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #e5e7eb',
        background: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onRun}
          disabled={isRunning}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #2563eb',
            background: isRunning ? '#93c5fd' : '#2563eb',
            color: '#fff',
            fontWeight: 700,
            cursor: isRunning ? 'not-allowed' : 'pointer',
          }}
          title={isRunning ? 'Running…' : 'Run tests'}
        >
          {isRunning ? 'Running…' : 'Run'}
        </button>

        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitted}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: !canSubmit || submitted ? '1px solid #cbd5e1' : '1px solid #10b981',
            background: !canSubmit || submitted ? '#e2e8f0' : '#10b981',
            color: !canSubmit || submitted ? '#64748b' : '#fff',
            fontWeight: 700,
            cursor: !canSubmit || submitted ? 'not-allowed' : 'pointer',
          }}
          title={!canSubmit ? 'Run tests first' : submitted ? 'Already submitted' : 'Submit results'}
        >
          {submitted ? 'Submitted' : 'Submit'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#475569' }}>
        {submitted
          ? 'Submitted. Advancing to next question...'
          : canSubmit
          ? 'Run complete. You can submit.'
          : isRunning
          ? 'Running…'
          : 'Click Run to execute tests.'}
      </div>
    </div>
  );
};

const TestsAndConsole: React.FC<{
  testsRootRef: React.RefObject<HTMLDivElement>;
}> = ({ testsRootRef }) => {
  return (
    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
      {/* Keep built-in Test controls visible */}
      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests style={{ height: '100%' }} watchMode={false} showWatchButton={false} showVerboseButton={false} />
      </div>

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
    framework,
    assignmentId,
    questionId,
    isLastQuestion,
    onNext,
    onComplete,
    template,
    codeFile,
    testFile,
  } = props;

  const [isRunning, setIsRunning] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any } | null>(null);

  const { sandpack } = useSandpack();
  const testsRootRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const runTimerRef = useRef<number | null>(null);
  const buttonClickIntervalRef = useRef<number | null>(null);

  // Track if we've successfully found and clicked a test button
  const [testButtonFound, setTestButtonFound] = useState(false);

  const files = useMemo<SandpackFiles>(() => {
    if (!testCode) return {};
    return {
      [codeFile]: { code: starterCode ?? '', active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
      // Provide vitest config + setup to ensure jsdom/jest-dom in most templates
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

  // Observe test panel for summary and enable submit when any run completes
  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;

    // Reset for new question/framework
    setIsRunning(false);
    setCanSubmit(false);
    setSubmitted(false);
    setLastRawText('');
    setLastParsed(null);
    setTestButtonFound(false);

    observerRef.current?.disconnect();
    if (buttonClickIntervalRef.current) {
      window.clearInterval(buttonClickIntervalRef.current);
      buttonClickIntervalRef.current = null;
    }

    const observe = () => {
      const obs = new MutationObserver(() => {
        const text = root.textContent || '';
        
        // Check if test button is available when DOM changes
        const testButton = findTestButton(root);
        if (testButton && !testButtonFound) {
          setTestButtonFound(true);
          console.log('[SandpackTest] Test button found and ready');
        }
        
        if (!text) return;
        
        setLastRawText(text);
        const parsed = parseSummary(text);
        setLastParsed(parsed);
        
        if (parsed.ran) {
          console.log('[SandpackTest] Tests completed, parsed results:', parsed);
          setCanSubmit(true);
          setIsRunning(false);
          obs.disconnect();
          observerRef.current = null;
          if (buttonClickIntervalRef.current) {
            window.clearInterval(buttonClickIntervalRef.current);
            buttonClickIntervalRef.current = null;
          }
        }
      });
      obs.observe(root, { childList: true, subtree: true, characterData: true });
      observerRef.current = obs;
    };

    observe();

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (runTimerRef.current) {
        window.clearTimeout(runTimerRef.current);
        runTimerRef.current = null;
      }
      if (buttonClickIntervalRef.current) {
        window.clearInterval(buttonClickIntervalRef.current);
        buttonClickIntervalRef.current = null;
      }
    };
  }, [framework, codeFile, testFile, starterCode, testCode, testButtonFound]);

  const findTestButton = (root: HTMLElement): HTMLButtonElement | null => {
    // Try multiple selectors to find the test run button
    const selectors = [
      '[data-testid="test-actions"] button',
      '.sp-test-actions button',
      'button[title*="run"]',
      'button[title*="test"]',
      'button[title*="Run"]',
      'button[title*="Test"]',
      '.sp-button:not([disabled])',
    ];
    
    for (const selector of selectors) {
      const button = root.querySelector(selector) as HTMLButtonElement | null;
      if (button && !button.disabled) {
        // Additional check to make sure it's likely a test button
        const text = button.textContent?.toLowerCase() || '';
        const title = button.title?.toLowerCase() || '';
        if (text.includes('run') || text.includes('test') || title.includes('run') || title.includes('test') || selector.includes('test-actions')) {
          console.log('[SandpackTest] Found test button with selector:', selector, 'text:', text, 'title:', title);
          return button;
        }
      }
    }
    
    // Last resort: find any button in the test area that's not disabled
    const buttons = root.querySelectorAll('button:not([disabled])');
    for (const button of buttons) {
      const btn = button as HTMLButtonElement;
      const text = btn.textContent?.toLowerCase() || '';
      if (text && (text.includes('run') || text.includes('test'))) {
        console.log('[SandpackTest] Found test button via fallback:', text);
        return btn;
      }
    }
    
    return null;
  };

  const clickTestsRunIfPresent = (): boolean => {
    const host = testsRootRef.current;
    if (!host) return false;
    
    const btn = findTestButton(host);
    if (btn) {
      console.log('[SandpackTest] Clicking test button:', btn.textContent);
      btn.click();
      return true;
    }
    
    console.log('[SandpackTest] No test button found');
    return false;
  };

  const startButtonClickInterval = () => {
    if (buttonClickIntervalRef.current) {
      window.clearInterval(buttonClickIntervalRef.current);
      buttonClickIntervalRef.current = null;
    }
    
    let attempts = 0;
    console.log('[SandpackTest] Starting button click interval...');
    
    buttonClickIntervalRef.current = window.setInterval(() => {
      attempts += 1;
      
      if (clickTestsRunIfPresent()) {
        console.log('[SandpackTest] Successfully clicked test button on attempt', attempts);
        window.clearInterval(buttonClickIntervalRef.current!);
        buttonClickIntervalRef.current = null;
        return;
      }
      
      if (attempts > 50) { // Reduced from 80 to avoid excessive attempts
        console.log('[SandpackTest] Giving up on finding test button after', attempts, 'attempts');
        window.clearInterval(buttonClickIntervalRef.current!);
        buttonClickIntervalRef.current = null;
        setIsRunning(false); // Reset running state if we can't find the button
        return;
      }
      
      if (attempts % 10 === 0) {
        console.log('[SandpackTest] Still looking for test button, attempt', attempts);
      }
    }, 300); // Increased interval to 300ms for better reliability
  };

  const handleRun = () => {
    console.log('[SandpackTest] HandleRun called');
    
    // Reset gating and start run
    setCanSubmit(false);
    setSubmitted(false);
    setIsRunning(true);
    setLastRawText('');
    setLastParsed(null);
    setTestButtonFound(false);

    // Try immediate click first
    const immediateClick = clickTestsRunIfPresent();
    console.log('[SandpackTest] Immediate click result:', immediateClick);

    // Always restart Sandpack to ensure fresh state
    try {
      console.log('[SandpackTest] Restarting Sandpack...');
      sandpack.runSandpack();
    } catch (error) {
      console.error('[SandpackTest] Error restarting Sandpack:', error);
    }

    // Also try internal dispatch if available
    try {
      (sandpack as any)?.dispatch?.({ type: 'run-tests' });
      console.log('[SandpackTest] Dispatched run-tests');
    } catch (error) {
      console.log('[SandpackTest] Could not dispatch run-tests:', error);
    }

    // Start the button clicking interval
    startButtonClickInterval();

    // Safety fallback to exit "Running…" state
    if (runTimerRef.current) {
      window.clearTimeout(runTimerRef.current);
    }
    runTimerRef.current = window.setTimeout(() => {
      console.log('[SandpackTest] Run timeout reached, stopping running state');
      setIsRunning(false);
      if (buttonClickIntervalRef.current) {
        window.clearInterval(buttonClickIntervalRef.current);
        buttonClickIntervalRef.current = null;
      }
    }, 20000); // Increased timeout to 20 seconds
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

    const score = total && typeof failed === 'number' ? (failed === 0 && total > 0 ? 1 : 0) : 0;

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

      console.log('[SandpackTest] Successfully submitted results');
      setSubmitted(true);

      try {
        window.dispatchEvent(
          new CustomEvent('sandpack:submitted', {
            detail: { assignmentId, questionId, score, passed, failed, total, rawText: lastRawText },
          })
        );
      } catch (error) {
        console.log('[SandpackTest] Could not dispatch submitted event:', error);
      }

      // Use the parent callbacks to handle navigation
      setTimeout(() => {
        console.log('[SandpackTest] Advancing to next question/completion');
        if (isLastQuestion) {
          onComplete();
        } else {
          onNext();
        }
      }, 2000); // Give user a moment to see the "Submitted" state

    } catch (err) {
      console.error('[SandpackTest] submit exception', err);
      alert('Unexpected error during submit.');
    }
  };

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <>
      <Toolbar isRunning={isRunning} canSubmit={canSubmit} submitted={submitted} onRun={handleRun} onSubmit={handleSubmit} />
      <div className="gt-sp">
        <SandpackLayout>
          {/* Editor */}
          <SandpackCodeEditor style={{ height: '70vh' }} showTabs showLineNumbers showInlineErrors />
          {/* Tests + Console */}
          <TestsAndConsole testsRootRef={testsRootRef} />
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
      // vitest config + setup injected in inner component too (kept here for visibility)
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
      key={`${template}-${codeFile}-${testFile}-${props.questionId}`} // Added questionId to key to force re-render
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
