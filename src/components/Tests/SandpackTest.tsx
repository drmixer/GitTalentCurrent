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
import { supabase } from '../../lib/supabase';

type Framework = 'react' | 'vue' | 'vanilla';

interface SandpackTestProps {
  // Code the candidate edits
  starterCode: string;
  // Tests for this question
  testCode: string | null | undefined;
  // Which stack to run for this question
  framework: Framework; // react (TS), vue (Vue 3), vanilla (TS)

  // IDs for persistence
  assignmentId: string;
  questionId: string;

  // Navigation and flow
  isLastQuestion?: boolean;
  onNext?: () => void;       // called after successful submit when not last
  onComplete?: () => void;   // called after successful submit when last

  // Optional route fallbacks if no callbacks wired
  completionUrl?: string;    // default '/tests/completed'
  dashboardUrl?: string;     // default '/dashboard'
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

// Parse a jest-style summary from the Tests panel text.
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
          ? 'Submitted.'
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
      {/* Hide any built-in run/watch buttons so there is only one Run (ours) */}
      <style>{`
        .gt-sp .sp-test-actions button,
        .gt-sp [data-testid="test-actions"] button,
        .gt-sp [class*="sp-preview-actions"] button {
          display: none !important;
        }
      `}</style>

      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests
          style={{ height: '100%' }}
          watchMode={false}
          showWatchButton={false}
          showVerboseButton={false}
        />
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
    completionUrl = '/tests/completed',
    dashboardUrl = '/dashboard',
    template,
    codeFile,
    testFile,
    deps,
  } = props;

  const [isRunning, setIsRunning] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any } | null>(null);

  const testsRootRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const runTimerRef = useRef<number | null>(null);

  const files = useMemo<SandpackFiles>(() => {
    if (!testCode) return {};
    return {
      [codeFile]: { code: starterCode ?? '', active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
    };
  }, [starterCode, testCode, codeFile, testFile]);

  const { sandpack } = useSandpack();

  // Detect the first summary after a run; then enable submit.
  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;

    // Reset for new question/framework
    setIsRunning(false);
    setCanSubmit(false);
    setSubmitted(false);
    setLastRawText('');
    setLastParsed(null);

    observerRef.current?.disconnect();

    const check = () => {
      const text = root.textContent || '';
      if (!text || text === lastRawText) return;

      setLastRawText(text);
      const parsed = parseSummary(text);
      setLastParsed(parsed);

      if (parsed.ran) {
        setCanSubmit(true);
        // Stop the "running" state
        if (runTimerRef.current) {
          window.clearTimeout(runTimerRef.current);
          runTimerRef.current = null;
        }
        setIsRunning(false);

        // Disconnect to avoid further DOM churn
        observerRef.current?.disconnect();
        observerRef.current = null;
      }
    };

    const obs = new MutationObserver(() => {
      window.requestAnimationFrame(check);
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    observerRef.current = obs;

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (runTimerRef.current) {
        window.clearTimeout(runTimerRef.current);
        runTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework, codeFile, testFile, starterCode, testCode]);

  const handleRun = () => {
    // Reset submit gating and start the run
    setCanSubmit(false);
    setSubmitted(false);
    setIsRunning(true);
    setLastRawText('');
    setLastParsed(null);

    observerRef.current?.disconnect();
    observerRef.current = null;

    // Re-attach observer for this run
    const root = testsRootRef.current;
    if (root) {
      const obs = new MutationObserver(() => {
        const text = root.textContent || '';
        const parsed = parseSummary(text);
        if (text) {
          setLastRawText(text);
          setLastParsed(parsed);
        }
        if (parsed.ran) {
          setCanSubmit(true);
          setIsRunning(false);
          obs.disconnect();
          observerRef.current = null;
        }
      });
      obs.observe(root, { childList: true, subtree: true, characterData: true });
      observerRef.current = obs;
    }

    // Trigger Sandpack test run
    sandpack.runSandpack();

    // Fallback to prevent stuck "Running…" state
    runTimerRef.current = window.setTimeout(() => {
      setIsRunning(false);
    }, 15000);
  };

  const handleSubmit = async () => {
    if (!lastParsed) return;

    const tests = lastParsed.tests || {};
    const total = typeof tests.total === 'number' ? tests.total : undefined;
    const failed = typeof tests.failed === 'number' ? tests.failed : undefined;
    const passed = typeof tests.passed === 'number' ? tests.passed : undefined;

    const score = total && typeof failed === 'number' ? (failed === 0 && total > 0 ? 1 : 0) : 0;

    try {
      // Persist to Supabase
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
            stderr: '', // tests panel doesn't separate stderr; keep empty
          },
          { onConflict: 'assignment_id,question_id' }
        );

      if (upsertError) {
        // eslint-disable-next-line no-console
        console.error('[SandpackTest] submit upsert error', upsertError);
        alert('Failed to submit results. Please try again.');
        return;
      }

      setSubmitted(true);

      // Notify app-level listeners
      try {
        window.dispatchEvent(
          new CustomEvent('sandpack:submitted', {
            detail: {
              assignmentId,
              questionId,
              score,
              passed,
              failed,
              total,
              rawText: lastRawText,
            },
          })
        );
      } catch {}

      // Navigate based on position in flow
      if (isLastQuestion) {
        if (typeof onComplete === 'function') {
          onComplete();
        } else {
          // Fallback: go to completion screen, then to dashboard
          const doneUrl = props.completionUrl || '/tests/completed';
          const dashUrl = props.dashboardUrl || '/dashboard';
          try {
            window.history.pushState({}, '', doneUrl);
          } catch {
            window.location.assign(doneUrl);
          }
          setTimeout(() => {
            try {
              window.location.assign(dashUrl);
            } catch {}
          }, 1500);
        }
      } else {
        if (typeof onNext === 'function') {
          onNext();
        } else {
          // Fallback event for parent routers
          try {
            window.dispatchEvent(
              new CustomEvent('sandpack:next', {
                detail: { assignmentId, questionId },
              })
            );
          } catch {}
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[SandpackTest] submit exception', err);
      alert('Unexpected error during submit.');
    }
  };

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <>
      <Toolbar
        isRunning={isRunning}
        canSubmit={canSubmit}
        submitted={submitted}
        onRun={handleRun}
        onSubmit={handleSubmit}
      />

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
    };
  }, [props.starterCode, props.testCode, codeFile, testFile]);

  if (!props.testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      key={`${template}-${codeFile}-${testFile}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{
        autorun: false, // only our Run button triggers execution
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
