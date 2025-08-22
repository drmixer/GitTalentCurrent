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
  isRunning: boolean;
  testKey: number; // Add a key to force re-render when needed
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

    let hasCompleted = false; // Prevent multiple completions

    const observe = () => {
      const obs = new MutationObserver(() => {
        if (hasCompleted) return; // Already processed
        
        const text = root.textContent || '';
        
        if (!text) return;
        
        const parsed = parseSummary(text);
        
        // Check for test completion OR compilation errors
        const hasError = text.includes('Error') || text.includes('SyntaxError') || text.includes('TypeError');
        const hasCompileSuccess = text.includes('compiled successfully') || text.includes('Compiled successfully');
        
        // If we have a compilation success after an error, wait a bit more for tests
        if (hasCompileSuccess && !parsed.ran && !hasError) {
          console.log('[SandpackTest] Code compiled successfully, waiting for tests...');
          return; // Keep waiting for actual test results
        }
        
        // Mark as complete if we have test results or significant error
        if (parsed.ran || (hasError && text.length > 50)) {
          hasCompleted = true;
          console.log('[SandpackTest] Tests completed or significant error detected, calling onTestsComplete');
          onTestsComplete(text, parsed);
          obs.disconnect();
          observerRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      });
      
      obs.observe(root, { 
        childList: true, 
        subtree: true, 
        characterData: true
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
      }, 20000); // 20 second timeout
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
        {/* Use key to force re-render when needed */}
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
  const [testKey, setTestKey] = useState(0); // Force re-render key

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

  // Handle test completion from the observer
  const handleTestsComplete = (rawText: string, parsed: any) => {
    console.log('[SandpackTest] Tests completed with results:', parsed, 'rawText length:', rawText.length);
    setLastRawText(rawText);
    setLastParsed(parsed);
    setHasTestResults(true);
    setIsRunning(false);
  };

  // Improved test runner using useSandpack hook
  const handleRunTests = async () => {
    console.log('[SandpackTest] Running tests...');
    setIsRunning(true);
    
    // Reset all previous state for fresh run
    setLastRawText('');
    setLastParsed(null);
    setHasTestResults(false);
    setTestKey(prev => prev + 1); // Force re-render of test components

    try {
      // Log available sandpack methods for debugging
      console.log('[SandpackTest] Available sandpack methods:', Object.keys(sandpack));
      
      // Simple approach: Just wait a bit for components to render, then look for test button
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to find and click the test button with improved selectors
      let testButton = null;
      let attempts = 0;
      const maxAttempts = 10;
      
      // Keep trying to find the test button with more comprehensive selectors
      while (!testButton && attempts < maxAttempts) {
        attempts++;
        console.log(`[SandpackTest] Attempt ${attempts} to find test button`);
        
        // More specific selectors that avoid file tabs
        const selectors = [
          // Standard Sandpack test runner selectors (most specific first)
          '.sp-tests button:not([disabled]):not(.sp-tab-button)',
          '[data-sp-tests] button:not([disabled]):not(.sp-tab-button)',
          '.sp-test-runner button:not([disabled]):not(.sp-tab-button)',
          
          // Look for buttons with "Run" in the text content specifically
          'button:not([disabled]):not(.sp-tab-button)',  // We'll filter by text content below
        ];
        
        for (const selector of selectors) {
          try {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
              if (btn instanceof HTMLButtonElement && !btn.disabled) {
                // Make sure it's actually visible and clickable
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  const buttonText = (btn.textContent || '').toLowerCase();
                  const buttonTitle = (btn.title || '').toLowerCase();
                  const buttonAriaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                  
                  // Skip file tabs and other non-test buttons
                  if (btn.classList.contains('sp-tab-button')) {
                    continue;
                  }
                  
                  // Look for actual test run buttons
                  if (
                    buttonText.includes('run') ||
                    buttonTitle.includes('run') ||
                    buttonAriaLabel.includes('run') ||
                    buttonText.includes('test') ||
                    buttonTitle.includes('run test') ||
                    buttonAriaLabel.includes('test')
                  ) {
                    // Make sure it's not a file tab
                    if (!buttonTitle.includes('.test.') && !buttonTitle.includes('.spec.')) {
                      testButton = btn;
                      console.log('[SandpackTest] Found test button with selector:', selector, 'button:', btn, 'text:', buttonText, 'title:', buttonTitle);
                      break;
                    }
                  }
                }
              }
            }
            if (testButton) break;
          } catch (e) {
            console.warn('[SandpackTest] Invalid selector:', selector, e);
          }
        }
        
        if (!testButton) {
          // Debug: log all available buttons to see what we're missing
          const allButtons = document.querySelectorAll('button');
          console.log('[SandpackTest] All buttons on page:');
          allButtons.forEach((btn, index) => {
            console.log(`  ${index}: "${btn.textContent}" class="${btn.className}" title="${btn.title}" disabled=${btn.disabled}`);
          });
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (testButton && testButton instanceof HTMLButtonElement) {
        console.log('[SandpackTest] Clicking test button programmatically');
        // Try multiple click methods
        testButton.focus();
        testButton.click();
        
        // Also try dispatching events
        testButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        testButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        testButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        
      } else {
        console.log('[SandpackTest] Could not find test button after', maxAttempts, 'attempts');
        // Try alternative: Use sandpack's test runner API if available
        if (sandpack && typeof sandpack.runTests === 'function') {
          console.log('[SandpackTest] Trying sandpack.runTests() API');
          await sandpack.runTests();
        } else {
          console.log('[SandpackTest] Setting error state - no test button found');
          setIsRunning(false);
          setLastRawText('Could not find test button. The test interface may not be fully loaded. Please try again.');
          setLastParsed({ ran: false, error: true });
          setHasTestResults(true);
        }
      }
      
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
      // Check for compilation or runtime errors in the raw text
      const hasError = lastRawText.includes('Error') || lastRawText.includes('SyntaxError') || lastRawText.includes('TypeError');
      
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
      {/* Updated action bar with both run and submit buttons when tests have results */}
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

      {/* Add CSS animation for spinner */}
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
