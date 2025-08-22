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
  
  const ran = /Test suites?:|Test files?:|Tests?:|No tests found|PASS|FAIL|✓|✗|passed|failed/i.test(text);
  
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

  // If we can't parse structured output, try to infer from content
  if (!tests && ran) {
    const passCount = (text.match(/✓|PASS/g) || []).length;
    const failCount = (text.match(/✗|FAIL/g) || []).length;
    if (passCount > 0 || failCount > 0) {
      return {
        ran: true,
        suites,
        tests: {
          passed: passCount,
          failed: failCount,
          total: passCount + failCount
        }
      };
    }
  }

  const result = { ran, suites, tests };
  console.log('[SandpackTest] Parsed result:', result);
  return result;
}

const TestsAndConsole: React.FC<{
  testsRootRef: React.RefObject<HTMLDivElement>;
  onTestsComplete: (rawText: string, parsed: any) => void;
  isRunning: boolean;
  testKey: number;
}> = ({ testsRootRef, onTestsComplete, isRunning, testKey }) => {
  const observerRef = useRef<MutationObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const root = testsRootRef.current;
    if (!root || !isRunning) {
      // Clean up if not running
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    console.log('[SandpackTest] Setting up test completion observer with key:', testKey);

    // Clear any existing observer and timeout
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    let hasCompleted = false;

    const observe = () => {
      const obs = new MutationObserver(() => {
        if (hasCompleted) return;
        
        const text = root.textContent || '';
        
        if (!text) return;
        
        console.log('[SandpackTest] Observer detected text change:', text.substring(0, 200));
        
        const parsed = parseSummary(text);
        
        // Check for test completion, compilation errors, or test results
        const hasError = /Error|SyntaxError|TypeError|ReferenceError/i.test(text);
        const hasCompileSuccess = /compiled successfully|Compiled successfully/i.test(text);
        const hasTestOutput = /PASS|FAIL|✓|✗|passed|failed|Test.*:|expect/i.test(text);
        
        // Consider completion if we have meaningful test output
        if (parsed.ran || hasTestOutput || (hasError && text.length > 50)) {
          hasCompleted = true;
          console.log('[SandpackTest] Tests completed - parsed:', parsed, 'hasTestOutput:', hasTestOutput, 'hasError:', hasError);
          onTestsComplete(text, parsed);
          obs.disconnect();
          observerRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        } else if (hasCompileSuccess && !parsed.ran) {
          console.log('[SandpackTest] Code compiled successfully, continuing to wait for tests...');
        }
      });
      
      obs.observe(root, { 
        childList: true, 
        subtree: true, 
        characterData: true,
        attributes: true
      });
      observerRef.current = obs;

      // Set a timeout to handle stuck tests
      timeoutRef.current = setTimeout(() => {
        if (hasCompleted) return;
        console.log('[SandpackTest] Observer timeout - tests seem stuck');
        hasCompleted = true;
        const text = root.textContent || '';
        onTestsComplete(text, { ran: false, error: true });
        obs.disconnect();
        observerRef.current = null;
        timeoutRef.current = null;
      }, 25000); // 25 second timeout
    };

    observe();

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [onTestsComplete, isRunning, testKey]);

  return (
    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests 
          key={`tests-${testKey}`}
          style={{ height: '100%' }} 
          watchMode={false} 
          showWatchButton={false} 
          showVerboseButton={false}
          hideTestsAndSupressLogs={false}
        />
      </div>

      <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
        <SandpackConsole
          key={`console-${testKey}`}
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

  const [hasTestResults, setHasTestResults] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any; error?: boolean } | null>(null);
  const [testKey, setTestKey] = useState(0);

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
            scripts: { 
              test: 'vitest run --reporter=basic',
              'test:ui': 'vitest --ui'
            },
          },
          null,
          2
        ),
        hidden: true,
      },
    };
  }, [starterCode, testCode, codeFile, testFile]);

  // Handle test completion from the observer
  const handleTestsComplete = (rawText: string, parsed: any) => {
    console.log('[SandpackTest] Tests completed with results:', parsed, 'rawText length:', rawText.length);
    setLastRawText(rawText);
    setLastParsed(parsed);
    setHasTestResults(true);
    setIsRunning(false);
  };

  // New approach: Use sandpack client directly to execute tests
  const handleRunTests = async () => {
    console.log('[SandpackTest] Running tests...');
    setIsRunning(true);
    
    // Reset all previous state for fresh run
    setLastRawText('');
    setLastParsed(null);
    setHasTestResults(false);
    setTestKey(prev => prev + 1);

    try {
      console.log('[SandpackTest] Available sandpack methods:', Object.getOwnPropertyNames(sandpack));
      console.log('[SandpackTest] Sandpack clients:', sandpack.clients);
      console.log('[SandpackTest] Sandpack status:', sandpack.sandpack.status);

      // Method 1: Try to run the sandbox first to ensure everything is compiled
      if (sandpack.runSandpack) {
        console.log('[SandpackTest] Running sandbox...');
        await sandpack.runSandpack();
        
        // Wait for compilation to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Method 2: Try to access the sandpack client directly
      const clients = sandpack.clients;
      console.log('[SandpackTest] Available clients:', Object.keys(clients));
      
      for (const [clientId, client] of Object.entries(clients)) {
        console.log(`[SandpackTest] Client ${clientId}:`, client);
        
        if (client && typeof client.dispatch === 'function') {
          console.log(`[SandpackTest] Trying to run tests via client ${clientId}...`);
          
          // Try various command approaches
          try {
            // Approach 1: Direct test command
            await client.dispatch({
              type: 'shell',
              command: 'npm test'
            });
            
            console.log('[SandpackTest] Dispatched npm test command');
            
            // Wait and try another approach
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Approach 2: Try vitest directly
            await client.dispatch({
              type: 'shell',
              command: 'npx vitest run'
            });
            
            console.log('[SandpackTest] Dispatched vitest run command');
            
          } catch (dispatchError) {
            console.log(`[SandpackTest] Client ${clientId} dispatch error:`, dispatchError);
          }
        }
      }

      // Method 3: Try the original dispatch approach with different commands
      if (sandpack.dispatch) {
        console.log('[SandpackTest] Trying sandpack.dispatch approaches...');
        
        const commands = [
          { type: 'run-tests' },
          { type: 'test' },
          { type: 'shell', command: 'npm test' },
          { type: 'shell', command: 'npm run test' },
          { type: 'shell', command: 'npx vitest run' },
          { type: 'command', command: 'test' },
        ];
        
        for (const command of commands) {
          try {
            console.log('[SandpackTest] Trying dispatch command:', command);
            sandpack.dispatch(command);
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.log('[SandpackTest] Command failed:', command, error);
          }
        }
      }

      // Method 4: Try to trigger tests by updating files
      console.log('[SandpackTest] Trying file-based trigger...');
      if (sandpack.updateFile) {
        try {
          // Force a small update to the test file to trigger re-run
          const currentTestCode = sandpack.sandpack.files[testFile]?.code || testCode;
          sandpack.updateFile(testFile, currentTestCode + '\n// trigger');
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Restore original content
          sandpack.updateFile(testFile, currentTestCode || '');
          
          console.log('[SandpackTest] Triggered via file update');
        } catch (error) {
          console.log('[SandpackTest] File update trigger failed:', error);
        }
      }

      // Method 5: Look for and simulate clicks on any hidden test buttons
      console.log('[SandpackTest] Looking for hidden test execution mechanisms...');
      
      // Wait a bit longer for everything to settle
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to find test buttons with more aggressive selectors
      const possibleSelectors = [
        '.sp-tests button',
        '[data-sp-tests] button',
        '.sp-test-runner button',
        'button[data-testid*="test"]',
        'button[aria-label*="test"]',
        'button[title*="test"]',
        '.sp-c-tests button',
        '.sandpack-tests button',
      ];
      
      for (const selector of possibleSelectors) {
        try {
          const buttons = document.querySelectorAll(selector);
          console.log(`[SandpackTest] Found ${buttons.length} buttons with selector: ${selector}`);
          
          for (const button of buttons) {
            if (button instanceof HTMLElement && !button.classList.contains('sp-tab-button')) {
              console.log(`[SandpackTest] Trying to click button:`, button.textContent, button.className);
              button.click();
              
              // Also try focus and dispatch events
              button.focus();
              button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (error) {
          console.log(`[SandpackTest] Selector ${selector} failed:`, error);
        }
      }

      // Give everything some time to execute
      console.log('[SandpackTest] Waiting for test execution to complete...');
      
      // If nothing happens after reasonable time, we'll be caught by the observer timeout
      
    } catch (error) {
      console.error('[SandpackTest] Error running tests:', error);
      setIsRunning(false);
      setLastRawText('Error running tests: ' + String(error));
      setLastParsed({ ran: false, error: true });
      setHasTestResults(true);
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

    console.log('[SandpackTest] Score calculation:', {
      total,
      passed,
      failed,
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

      try {
        window.dispatchEvent(
          new CustomEvent('sandpack:submitted', {
            detail: { assignmentId, questionId, score, passed, failed, total, rawText: lastRawText },
          })
        );
      } catch (error) {
        console.log('[SandpackTest] Could not dispatch submitted event:', error);
      }

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

  const getStatusMessage = () => {
    if (submitted) {
      return { text: '✅ Submitted! Advancing to next question...', color: '#10b981' };
    }
    if (hasTestResults && lastParsed) {
      const hasError = /Error|SyntaxError|TypeError|ReferenceError/i.test(lastRawText);
      
      if (hasError && !lastParsed.ran) {
        return { text: '❌ Code has errors - fix them and try again', color: '#dc2626' };
      }
      
      if (lastParsed.ran) {
        const tests = lastParsed.tests || {};
        const total = tests.total || 0;
        const passed = tests.passed || 0;
        const failed = tests.failed || 0;
        
        if (failed === 0 && passed > 0) {
          return { text: `✅ All tests passed! (${passed}/${total})`, color: '#059669' };
        } else {
          return { text: `❌ Some tests failed (${passed}/${total} passed)`, color: '#dc2626' };
        }
      } else if (lastParsed.error) {
        return { text: '❌ Tests could not run - check your code for errors', color: '#dc2626' };
      }
    }
    if (isRunning) {
      return { text: '🔄 Running tests...', color: '#3b82f6' };
    }
    return { text: 'Write your code, then run tests to see results', color: '#64748b' };
  };

  const statusMessage = getStatusMessage();

  return (
    <>
      <div 
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}
      >
        <p style={{ margin: 0, fontSize: '14px', color: statusMessage.color, fontWeight: '500' }}>
          {statusMessage.text}
        </p>
        
        {submitted ? null : (
          <div style={{ display: 'flex', gap: '12px' }}>
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
                <>▶️ {hasTestResults ? 'Run Tests Again' : 'Run Tests'}</>
              )}
            </button>
            
            {hasTestResults && lastParsed && !lastParsed.error && lastParsed.ran && (
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
            )}
          </div>
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
            testKey={testKey}
          />
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
  test: { 
    environment: 'jsdom', 
    globals: true, 
    setupFiles: ['./setupTests.ts'],
    reporter: 'basic'
  },
});
        `.trim(),
        hidden: true,
      },
      '/setupTests.ts': { code: `import '@testing-library/jest-dom';`, hidden: true },
      '/package.json': {
        code: JSON.stringify(
          { 
            name: 'sandpack-tests', 
            private: true, 
            scripts: { 
              test: 'vitest run --reporter=basic',
              'test:watch': 'vitest --reporter=basic'
            } 
          },
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
        autoReload: false, // Prevent auto-reloading when files change
      }}
    >
      <SandpackTestInner {...props} template={template} codeFile={codeFile} testFile={testFile} deps={deps} />
    </SandpackProvider>
  );
};

export default SandpackTest;
