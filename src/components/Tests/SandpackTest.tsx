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

// Helper types and functions remain the same
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
  // ... (getSetup function is unchanged)
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
    // ... (parseSummary function is unchanged)
    const ran = /Test suites?:|Test files?:|Tests?:|No tests found/i.test(text);
    if (!ran) return { ran: false };
    const suitesLine = text.match(/Test suites?:([^\n]+)/i)?.[1] ?? text.match(/Test files?:([^\n]+)/i)?.[1] ?? '';
    const testsLine = text.match(/Tests?:([^\n]+)/i)?.[1] ?? '';
    const num = (re: RegExp, s: string) => s.match(re) ? Number(s.match(re)![1]) : undefined;
    const suites = suitesLine ? { passed: num(/(\d+)\s*passed/i, suitesLine), failed: num(/(\d+)\s*failed/i, suitesLine), total: num(/(\d+)\s*total/i, suitesLine) } : undefined;
    const tests = testsLine ? { passed: num(/(\d+)\s*passed/i, testsLine), failed: num(/(\d+)\s*failed/i, testsLine), total: num(/(\d+)\s*total/i, testsLine) } : undefined;
    return { ran, suites, tests };
}

/**
 * NEW: A dedicated component for our custom controls.
 * It disables the "Run Tests" button until the test client is fully ready.
 */
const CustomControls: React.FC<{
    onTestsComplete: (rawText: string, parsed: any) => void;
}> = ({ onTestsComplete }) => {
    const { sandpack } = useSandpack();
    const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
    const [isTestClientReady, setIsTestClientReady] = useState(false);
    const testsRootRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<MutationObserver | null>(null);

    // Listen for Sandpack messages to know when the test client is ready
    useEffect(() => {
        const unsubscribe = sandpack.listen((msg) => {
            if (msg.type === 'client-initialized' && msg.client.id === 'test') {
                console.log('[SandpackTest] Test client is now ready.');
                setIsTestClientReady(true);
            }
        });

        // Also check immediately in case we missed the message
        if (sandpack.clients.test) {
             console.log('[SandpackTest] Test client was already ready.');
             setIsTestClientReady(true);
        }

        return unsubscribe;
    }, [sandpack]);

    // Set up the observer to watch for test results in the DOM
    useEffect(() => {
        if (testStatus !== 'running') return;

        const root = testsRootRef.current;
        if (!root) return;

        observerRef.current?.disconnect();
        const obs = new MutationObserver(() => {
            const text = root.textContent || '';
            if (!text) return;
            const parsed = parseSummary(text);
            if (parsed.ran) {
                onTestsComplete(text, parsed);
                setTestStatus( (parsed.tests?.failed ?? 1) > 0 ? 'failed' : 'passed' );
                obs.disconnect();
            }
        });
        obs.observe(root, { childList: true, subtree: true, characterData: true });
        observerRef.current = obs;

        return () => {
            observerRef.current?.disconnect();
        };
    }, [testStatus, onTestsComplete]);

    const handleRunTests = () => {
        console.log('[SandpackTest] Running tests...');
        setTestStatus('running');
        if (sandpack.clients.test) {
            sandpack.clients.test.dispatch({ type: 'run-test' });
        } else {
            console.error('Attempted to run tests, but test client is not available.');
            setTestStatus('failed'); // Failsafe
        }
    };
    
    // This ref will be passed to a div wrapping SandpackTests
    const getTestsRootRef = () => testsRootRef;

    return {
        testStatus,
        handleRunTests,
        isTestClientReady,
        getTestsRootRef,
    };
};


const SandpackTest: React.FC<SandpackTestProps> = (props) => {
    const { template, codeFile, testFile, deps } = getSetup(props.framework);
    
    // Do not render anything until the necessary code props are available.
    if (!props.starterCode || !props.testCode) {
        return <div>Loading Question...</div>;
    }

    return (
        <SandpackProvider
            key={`${props.framework}-${props.questionId}`}
            template={template}
            customSetup={{ dependencies: deps }}
            files={{
                [codeFile]: { code: props.starterCode, active: true },
                [testFile]: { code: props.testCode },
                '/vitest.config.ts': { code: `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./setupTests.ts'] } });`, hidden: true },
                '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
                '/package.json': { code: JSON.stringify({ name: 'sandpack-tests', private: true, scripts: { test: 'vitest run --reporter=basic' } }, null, 2), hidden: true },
            }}
            options={{
                autorun: false,
                initMode: 'immediate',
                visibleFiles: [codeFile, testFile],
                activeFile: codeFile,
            }}
        >
            <SandpackTestInner {...props} />
        </SandpackProvider>
    );
};


const SandpackTestInner: React.FC<SandpackTestProps> = ({ assignmentId, questionId, isLastQuestion, onNext, onComplete }) => {
    const [submitted, setSubmitted] = useState(false);
    const [lastResult, setLastResult] = useState<{ rawText: string; parsed: any } | null>(null);

    const onTestsComplete = (rawText: string, parsed: any) => {
        console.log('[SandpackTest] Tests Completed:', parsed);
        setLastResult({ rawText, parsed });
    };

    const { testStatus, handleRunTests, isTestClientReady, getTestsRootRef } = CustomControls({ onTestsComplete });

    const handleSubmit = async () => {
        if (!lastResult) return;
        const { rawText, parsed } = lastResult;
        const tests = parsed.tests || {};
        const total = tests.total;
        const failed = tests.failed;
        const passed = tests.passed;
        const score = (total && total > 0 && failed === 0) ? 1 : 0;
        
        try {
            const { error } = await supabase.from('test_results').upsert({
                assignment_id: assignmentId,
                question_id: questionId,
                score,
                passed_test_cases: passed ?? null,
                total_test_cases: total ?? null,
                stdout: rawText,
                stderr: '',
            }, { onConflict: 'assignment_id,question_id' });

            if (error) throw error;

            setSubmitted(true);
            setTimeout(() => isLastQuestion ? onComplete() : onNext(), 2000);
        } catch (err) {
            console.error('Submit error:', err);
            alert('Failed to submit results.');
        }
    };

    const renderActionButtons = () => {
        const baseStyle: React.CSSProperties = {
            padding: '10px 20px', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600,
            fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
        };

        if (testStatus === 'running') {
            return ( <button disabled style={{ ...baseStyle, backgroundColor: '#94a3b8', cursor: 'not-allowed' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #ffffff40', borderTop: '2px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Running Tests...
            </button>);
        }
        
        if (testStatus === 'passed' || testStatus === 'failed') {
            return (
                <>
                    <button onClick={handleRunTests} style={{ ...baseStyle, backgroundColor: '#64748b' }}> 🔄 Run Again </button>
                    <button onClick={handleSubmit} style={{ ...baseStyle, backgroundColor: testStatus === 'passed' ? '#10b981' : '#f59e0b' }}> Submit Results </button>
                </>
            );
        }
    
        // Idle State
        return (
            <button onClick={handleRunTests} disabled={!isTestClientReady} style={{ ...baseStyle, backgroundColor: '#3b82f6', cursor: isTestClientReady ? 'pointer' : 'not-allowed', opacity: isTestClientReady ? 1 : 0.6 }}>
                {isTestClientReady ? '▶️ Run Tests' : '⌛ Initializing...'}
            </button>
        );
    };

    const renderStatusMessage = () => {
        switch (testStatus) {
            case 'passed': return <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ All tests passed!</p>;
            case 'failed': return <p style={{ margin: 0, fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>❌ Some tests failed. You can submit or try again.</p>;
            case 'running': return <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Running tests, please wait...</p>;
            case 'idle':
            default: return <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{isTestClientReady ? 'Ready to run tests.' : 'Initializing test environment...'}</p>;
        }
    };

    return (
        <>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                {submitted ? <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>✅ Submitted! Advancing...</p> : (<> {renderStatusMessage()} {renderActionButtons()} </>)}
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <SandpackLayout>
                <SandpackCodeEditor style={{ height: '70vh' }} showTabs showLineNumbers showInlineErrors />
                <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
                    <div ref={getTestsRootRef()} style={{ flex: 1, minHeight: 0 }}>
                        <SandpackTests style={{ height: '100%' }} />
                    </div>
                    <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
                        <SandpackConsole />
                    </div>
                </div>
            </SandpackLayout>
        </>
    );
};

export default SandpackTest;
