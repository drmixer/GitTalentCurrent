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

// Helper types and functions
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
          react: '^18.2.0', 'react-dom': '^18.2.0', '@testing-library/react': '^14.2.1',
          '@testing-library/user-event': '^14.5.2', '@testing-library/jest-dom': '^6.4.2', vitest: '^0.34.6',
        },
      };
    case 'vue':
      return {
        template: 'vue3' as SandpackProviderProps['template'],
        codeFile: '/src/App.vue', testFile: '/src/App.test.ts',
        deps: {
          vue: '^3.4.21', '@vue/test-utils': '^2.4.5', '@testing-library/vue': '^8.0.3',
          '@testing-library/dom': '^9.3.4', '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2', vitest: '^0.34.6',
        },
      };
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
  const num = (re: RegExp, s: string) => (s.match(re) ? Number(s.match(re)![1]) : undefined);
  const tests = testsLine ? { passed: num(/(\d+)\s*passed/i, testsLine), failed: num(/(\d+)\s*failed/i, testsLine), total: num(/(\d+)\s*total/i, testsLine) } : undefined;
  return { ran, tests };
}


// This component contains the view and all the logic. It must be a child of SandpackProvider.
const SandpackView: React.FC<SandpackTestProps> = (props) => {
  const { sandpack } = useSandpack();
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState<{ rawText: string; parsed: any } | null>(null);
  const testsContainerRef = useRef<HTMLDivElement>(null);
  
  // This effect watches the DOM for test results when a test is running.
  useEffect(() => {
    if (testStatus !== 'running') return;

    const observer = new MutationObserver(() => {
      const text = testsContainerRef.current?.textContent || '';
      if (!text) return;
      
      const parsed = parseSummary(text);
      if (parsed.ran) {
        console.log('[SandpackTest] Tests Completed:', parsed);
        setLastResult({ rawText: text, parsed });
        setTestStatus((parsed.tests?.failed ?? 1) > 0 ? 'failed' : 'passed');
        observer.disconnect();
      }
    });

    if (testsContainerRef.current) {
      observer.observe(testsContainerRef.current, { childList: true, subtree: true, characterData: true });
    }

    return () => observer.disconnect();
  }, [testStatus]);

  const handleRunTests = async () => {
    console.log('[SandpackTest] Attempting to run tests...');
    setTestStatus('running');
    setLastResult(null);

    try {
      // Poll with a generous timeout for the test client to be ready.
      let testClient = sandpack.clients.test;
      let attempts = 0;
      const maxAttempts = 40; // Poll for 10 seconds (40 * 250ms)

      while (!testClient && attempts < maxAttempts) {
        console.log(`[SandpackTest] Waiting for test client... Attempt ${attempts + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 250));
        testClient = sandpack.clients.test;
        attempts++;
      }

      if (testClient) {
        console.log(`[SandpackTest] Test client found! Dispatching run command.`);
        testClient.dispatch({ type: 'run-test' });
      } else {
        throw new Error('Sandpack test client did not initialize in time.');
      }
    } catch (error) {
      console.error('[SandpackTest] Error running tests:', error);
      setTestStatus('failed');
    }
  };

  const handleSubmit = async () => {
    if (!lastResult) return;
    const { rawText, parsed } = lastResult;
    const { total, failed, passed } = parsed.tests || {};
    const score = (total && total > 0 && failed === 0) ? 1 : 0;

    try {
      await supabase.from('test_results').upsert({
        assignment_id: props.assignmentId,
        question_id: props.questionId,
        score,
        passed_test_cases: passed ?? null,
        total_test_cases: total ?? null,
        stdout: rawText,
        stderr: '',
      }, { onConflict: 'assignment_id,question_id' });

      setSubmitted(true);
      setTimeout(() => (props.isLastQuestion ? props.onComplete() : props.onNext()), 2000);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit results.');
    }
  };

  const renderStatusMessage = () => {
    switch (testStatus) {
      case 'passed': return <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ All tests passed!</p>;
      case 'failed': return <p style={{ margin: 0, fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>❌ Some tests failed. You can submit or try again.</p>;
      case 'running': return <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Running tests, please wait...</p>;
      default: return <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Ready to run tests.</p>;
    }
  };

  const renderActionButtons = () => {
    const baseStyle: React.CSSProperties = {
      padding: '10px 20px', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600,
      fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
    };

    if (testStatus === 'running') {
      return (<button disabled style={{ ...baseStyle, backgroundColor: '#94a3b8', cursor: 'not-allowed' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid #ffffff40', borderTop: '2px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Running Tests...
        </button>);
    }
    if (testStatus === 'passed' || testStatus === 'failed') {
      return (<>
          <button onClick={handleRunTests} style={{ ...baseStyle, backgroundColor: '#64748b' }}> 🔄 Run Again </button>
          <button onClick={handleSubmit} style={{ ...baseStyle, backgroundColor: testStatus === 'passed' ? '#10b981' : '#f59e0b' }}> Submit Results </button>
        </>);
    }
    return <button onClick={handleRunTests} style={{ ...baseStyle, backgroundColor: '#3b82f6' }}> ▶️ Run Tests </button>;
  };

  return (
    <>
      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', height: '65px' }}>
        {submitted ? (<p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ Submitted! Advancing...</p>) : (<> {renderStatusMessage()} {renderActionButtons()} </>)}
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      
      <div style={{ height: 'calc(100vh - 65px)', display: 'flex', flexDirection: 'column' }}>
        <SandpackLayout style={{ flex: 1 }}>
          <SandpackCodeEditor style={{ height: '100%' }} showTabs showLineNumbers showInlineErrors />
          <div ref={testsContainerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '50%' }}>
            <SandpackTests style={{ flex: 1 }} />
            <SandpackConsole style={{ height: '180px', flexGrow: 0, flexShrink: 0, borderTop: '1px solid #e5e7eb' }} />
          </div>
        </SandpackLayout>
      </div>
    </>
  );
};

// This is the main export component. It sets up the provider and files.
const SandpackTest: React.FC<SandpackTestProps> = (props) => {
  const { template, codeFile, testFile, deps } = getSetup(props.framework);

  if (!props.starterCode || !props.testCode) {
    return <div>Loading Question...</div>;
  }

  const files = useMemo<SandpackFiles>(() => ({
      [codeFile]: { code: props.starterCode, active: true },
      [testFile]: { code: props.testCode! },
      '/vitest.config.ts': { code: `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`, hidden: true },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': { code: JSON.stringify({ name: 'sandpack-tests', private: true, scripts: { test: 'vitest run --reporter=basic' } }, null, 2), hidden: true },
  }), [props.starterCode, props.testCode, codeFile, testFile]);

  return (
    <SandpackProvider
      key={`${props.framework}-${props.questionId}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{ autorun: false, initMode: 'immediate' }}
    >
      <SandpackView {...props} />
    </SandpackProvider>
  );
};

export default SandpackTest;
