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

// Types

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

// Config setup

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

// Test parsing helper

function parseSummary(text: string) {
  const ran = /Test suites?:|Test files?:|Tests?:|No tests found/i.test(text);
  if (!ran) return { ran: false, suites: undefined, tests: undefined };

  const suitesLine = text.match(/Test suites?:([^
]+)/i)?.[1] ?? text.match(/Test files?:([^
]+)/i)?.[1] ?? '';
  const testsLine = text.match(/Tests?:([^
]+)/i)?.[1] ?? '';

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

// Tests + Console panel

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
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
          }}
        />
      </div>
    </div>
  );
};

// Main Inner Component

const SandpackTestInner: React.FC<
  SandpackTestProps & {
    template: SandpackProviderProps['template'];
    codeFile: string;
    testFile: string;
    deps: Record<string, string>;
  }
> = (props) => {
  const { starterCode, testCode, assignmentId, questionId, isLastQuestion, onNext, onComplete, codeFile, testFile } = props;

  const [canSubmit, setCanSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<any>(null);

  const { sandpack } = useSandpack();
  const testsRootRef = useRef<HTMLDivElement>(null);

  const files = useMemo<SandpackFiles>(() => {
    if (!testCode) return {};
    return {
      [codeFile]: { code: starterCode ?? '', active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
      '/vitest.config.ts': {
        code: `import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`,
        hidden: true,
      },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': {
        code: JSON.stringify(
          { name: 'sandpack-tests', version: '1.0.0', private: true, scripts: { test: 'vitest run --reporter=basic' } },
          null,
          2
        ),
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

  // ✅ Use Sandpack dispatch to trigger tests
  const handleRunTests = async () => {
    setIsRunning(true);
    setCanSubmit(false);
    setLastRawText('');
    setLastParsed(null);

    try {
      await sandpack.runSandpack();
      await new Promise((r) => setTimeout(r, 500));
      const firstClient = Object.values(sandpack.clients)[0];
      if (firstClient) {
        firstClient.dispatch({ type: "run-all-tests" });
      }
    } catch (err) {
      console.error("[SandpackTest] Error running tests", err);
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!lastParsed) return;

    const tests = lastParsed.tests || {};
    const total = tests.total;
    const failed = tests.failed;
    const passed = tests.passed;

    let score = 0;
    if (total && total > 0) {
      if (typeof failed === 'number') {
        score = failed === 0 ? 1 : 0;
      } else if (typeof passed === 'number') {
        score = passed === total ? 1 : 0;
      } else {
        score = 1;
      }
    }

    const { error: upsertError } = await supabase.from('test_results').upsert(
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
      alert('Failed to submit results. Please try again.');
      return;
    }

    setSubmitted(true);

    setTimeout(() => {
      if (isLastQuestion) onComplete();
      else onNext();
    }, 2000);
  };

  if (!testCode) return <div>This Sandpack question is missing its test code.</div>;

  return (
    <>
      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        {submitted ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ Submitted! Advancing...</p>
        ) : canSubmit ? (
          <>
            <button onClick={handleRunTests} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600' }}>Rerun Tests</button>
            <button onClick={handleSubmit} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600' }}>Submit Results</button>
          </>
        ) : (
          <button onClick={handleRunTests} disabled={isRunning} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600' }}>▶️ Run Tests</button>
        )}
      </div>

      <div className="gt-sp">
        <SandpackLayout>
          <SandpackCodeEditor style={{ height: '70vh' }} showTabs showLineNumbers showInlineErrors />
          <TestsAndConsole testsRootRef={testsRootRef} onTestsComplete={handleTestsComplete} />
        </SandpackLayout>
      </div>
    </>
  );
};

// Wrapper Provider

const SandpackTest: React.FC<SandpackTestProps> = (props) => {
  const { template, codeFile, testFile, deps } = getSetup(props.framework);

  const files = useMemo<SandpackFiles>(() => {
    if (!props.testCode) return {};
    return {
      [codeFile]: { code: props.starterCode ?? '', active: true },
      [testFile]: { code: props.testCode ?? '', hidden: false },
      '/vitest.config.ts': {
        code: `import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`,
        hidden: true,
      },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': {
        code: JSON.stringify({ name: 'sandpack-tests', private: true, scripts: { test: 'vitest run --reporter=basic' } }, null, 2),
        hidden: true,
      },
    };
  }, [props.starterCode, props.testCode, codeFile, testFile]);

  if (!props.testCode) return <div>This Sandpack question is missing its test code.</div>;

  return (
    <SandpackProvider
      key={`${template}-${codeFile}-${testFile}-${props.questionId}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{ autorun: false, initMode: 'immediate', showTabs: true, showNavigator: false, showInlineErrors: true, showErrorOverlay: true, visibleFiles: [codeFile, testFile], activeFile: codeFile }}
    >
      <SandpackTestInner {...props} template={template} codeFile={codeFile} testFile={testFile} deps={deps} />
    </SandpackProvider>
  );
};

export default SandpackTest;

