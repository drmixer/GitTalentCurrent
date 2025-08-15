import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackTests,
  useSandpack,
  SandpackFileExplorer,
  useSandpackClient,
} from '@codesandbox/sandpack-react';
import type { SandpackSetup, SandpackFiles } from '@codesandbox/sandpack-react';
import { supabase } from '../../lib/supabase';

// Create a singleton Supabase client to avoid multiple instances
let authClient: any = null;
const getAuthClient = async () => {
  if (!authClient) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      const { createClient } = await import('@supabase/supabase-js');
      authClient = createClient(
        supabase.supabaseUrl,
        supabase.supabaseKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          },
          auth: {
            persistSession: false,
          },
        }
      );
    }
  }
  return authClient;
};

// Simple inline toast notification component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ 
  message, 
  type, 
  onClose 
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        padding: '12px 24px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
        color: 'white',
        fontWeight: '500'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{message}</span>
        <button 
          onClick={onClose}
          style={{ 
            marginLeft: '16px', 
            background: 'none', 
            border: 'none', 
            color: 'white', 
            cursor: 'pointer',
            fontSize: '18px'
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Define the frameworks we support
type SupportedFramework = 'react' | 'vue' | 'angular' | 'javascript';

// Define the shape of the props for the component
interface SandpackTestProps {
  starterCode: string;
  testCode: string | undefined | null;
  framework: SupportedFramework;
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
}

// Framework configurations
const getFrameworkConfig = (framework: SupportedFramework): { setup: SandpackSetup, mainFile: string, testFile: string } => {
  switch (framework) {
    case 'vue':
      return {
        setup: {
          dependencies: {
            'vue': '^3.3.4',
            '@vue/test-utils': '^2.4.1',
            '@testing-library/vue': '^8.0.1',
            'vitest': '^0.34.6',
            'jsdom': '^22.1.0',
            '@vitejs/plugin-vue': '^4.3.4',
          },
          devDependencies: {
            '@vue/compiler-sfc': '^3.3.4',
          },
          template: 'vue',
        },
        mainFile: '/src/App.vue',
        testFile: '/src/App.spec.js',
      };

    case 'angular':
      return {
        setup: {
          dependencies: {
            '@angular/animations': '^16.0.0',
            '@angular/common': '^16.0.0',
            '@angular/compiler': '^16.0.0',
            '@angular/core': '^16.0.0',
            '@angular/forms': '^16.0.0',
            '@angular/platform-browser': '^16.0.0',
            '@angular/platform-browser-dynamic': '^16.0.0',
            'rxjs': '^7.8.0',
            'zone.js': '^0.13.0',
            'tslib': '^2.3.0',
          },
          devDependencies: {
            '@angular/testing': '^16.0.0',
            '@types/jasmine': '^4.3.0',
            'jasmine': '^4.5.0',
            'typescript': '^5.0.0',
          },
          template: 'angular',
        },
        mainFile: '/src/app/app.component.ts',
        testFile: '/src/app/app.component.spec.ts',
      };

    case 'javascript':
      return {
        setup: {
          dependencies: {
            '@testing-library/jest-dom': '^5.16.5',
            'whatwg-fetch': '^3.6.2',
          },
          devDependencies: {
            '@types/jest': '^29.5.5',
            'jest': '^29.5.0',
            'jest-environment-jsdom': '^29.5.0',
          },
          template: 'vanilla',
        },
        mainFile: '/src/index.js',
        testFile: '/src/index.test.js',
      };

    case 'react':
    default:
      return {
        setup: {
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1',
            '@testing-library/react': '^13.4.0',
            '@testing-library/jest-dom': '^5.16.5',
            '@testing-library/user-event': '^14.4.3',
            'whatwg-fetch': '^3.6.2',
          },
          devDependencies: {
            '@types/jest': '^29.5.5',
          },
          template: 'react',
        },
        mainFile: '/App.js',
        testFile: '/App.test.js',
      };
  }
};

// Enhanced test results detection component with status indicators
const TestResultsDisplay: React.FC<{ 
  onTestStateChange?: (passed: boolean) => void,
  onStatusChange?: (status: 'idle' | 'running' | 'complete') => void,
  questionId: string,
  framework: SupportedFramework 
}> = ({ onTestStateChange, onStatusChange, questionId, framework }) => {
  const { sandpack } = useSandpack();
  const sandpackClient = useSandpackClient();
  const hasDetectedTests = useRef(false);
  const lastStatus = useRef<string>('');
  const testTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Reset detection when question changes
  useEffect(() => {
    hasDetectedTests.current = false;
    lastStatus.current = '';
    if (testTimeout.current) {
      clearTimeout(testTimeout.current);
      testTimeout.current = null;
    }
    if (onStatusChange) {
      onStatusChange('idle');
    }
  }, [questionId, onStatusChange]);

  // Monitor sandpack status changes
  useEffect(() => {
    if (sandpack.status !== lastStatus.current) {
      lastStatus.current = sandpack.status;
      
      if (sandpack.status === 'running' || sandpack.status === 'bundling') {
        if (onStatusChange) {
          onStatusChange('running');
        }
        
        // Set timeout for Angular to prevent infinite running
        if (framework === 'angular' && !testTimeout.current) {
          testTimeout.current = setTimeout(() => {
            console.log('[Angular] Test timeout reached, marking as failed');
            if (!hasDetectedTests.current && onTestStateChange) {
              hasDetectedTests.current = true;
              onTestStateChange(false);
            }
            if (onStatusChange) {
              onStatusChange('complete');
            }
          }, 15000); // 15 second timeout for Angular
        }
      } else if (sandpack.status === 'complete' || sandpack.status === 'idle') {
        if (testTimeout.current) {
          clearTimeout(testTimeout.current);
          testTimeout.current = null;
        }
        if (onStatusChange) {
          onStatusChange('complete');
        }
      }
    }
  }, [sandpack.status, onStatusChange, framework, onTestStateChange]);
  
  // Listen for test completion messages from Sandpack
  useEffect(() => {
    if (!sandpackClient) return;

    const unsubscribe = sandpackClient.listen((message) => {
      // Handle errors and log them
      if (message.type === 'error') {
        console.log('Sandpack error message:', message);
        if (!hasDetectedTests.current) {
          hasDetectedTests.current = true;
          if (onTestStateChange) {
            onTestStateChange(false);
          }
          if (testTimeout.current) {
            clearTimeout(testTimeout.current);
            testTimeout.current = null;
          }
        }
      }
      
      // Listen for test completion messages
      if (message.type === 'test') {
        console.log('Test message received:', message);
        if (message.event === 'test_end' && !hasDetectedTests.current) {
          hasDetectedTests.current = true;
          const results = message.results;
          if (results && Array.isArray(results)) {
            const allPassed = results.every((result: any) => result.status === 'pass');
            if (onTestStateChange) {
              onTestStateChange(allPassed);
            }
          }
          if (testTimeout.current) {
            clearTimeout(testTimeout.current);
            testTimeout.current = null;
          }
        }
      }
      
      // Listen for console messages that might indicate test results
      if (message.type === 'console' && message.log && !hasDetectedTests.current) {
        message.log.forEach(log => {
          if (typeof log.data === 'string') {
            const logData = log.data;
            console.log(`[${framework}] Console log:`, logData);
            
            // Framework-specific error detection
            const hasError = 
              logData.includes('ERROR') || 
              logData.includes('RuntimeError') ||
              logData.includes('TypeError') ||
              logData.includes('ReferenceError') ||
              logData.includes('SyntaxError') ||
              logData.includes('Failed to compile') ||
              logData.includes('Module not found') ||
              logData.includes('Cannot resolve dependency') ||
              (framework === 'angular' && (
                logData.includes('NG0') || 
                logData.includes('NullInjectorError') ||
                logData.includes('Can\'t resolve all parameters') ||
                logData.includes('No provider for') ||
                logData.includes('StaticInjectorError')
              )) ||
              (framework === 'vue' && logData.includes('[Vue warn]')) ||
              (framework === 'react' && logData.includes('Warning: React'));

            if (hasError) {
              console.log(`[${framework}] Detected error in console:`, logData);
              hasDetectedTests.current = true;
              if (onTestStateChange) {
                onTestStateChange(false);
              }
              if (testTimeout.current) {
                clearTimeout(testTimeout.current);
                testTimeout.current = null;
              }
              return;
            }

            // Framework-specific success patterns
            let testPassed = false;
            let testFailed = false;

            switch (framework) {
              case 'angular':
                testPassed = (
                  logData.includes('Compiled successfully') ||
                  (logData.includes('spec') && logData.includes('0 failures')) ||
                  logData.includes('All tests passed') ||
                  (logData.includes('Executed') && logData.includes('SUCCESS')) ||
                  logData.includes('✓') ||
                  logData.includes('TOTAL: 1 SUCCESS')
                );
                testFailed = (
                  (logData.includes('Executed') && logData.includes('FAILED')) ||
                  logData.includes('TOTAL: 0 SUCCESS') ||
                  logData.includes('Expected:') ||
                  logData.includes('Actual:') ||
                  logData.includes('failures') ||
                  logData.includes('FAILED')
                );
                break;

              case 'react':
                testPassed = (
                  (logData.includes('PASS') && logData.includes('test')) ||
                  logData.includes('✓') ||
                  (logData.includes('Tests:') && (logData.includes('passed') || logData.includes('1 passed'))) ||
                  logData.includes('All tests passed') ||
                  logData.match(/\d+ passing/) ||
                  logData.includes('Test Suites: 1 passed')
                );
                testFailed = (
                  logData.includes('FAIL') || 
                  logData.includes('✗') ||
                  logData.includes('failed') ||
                  logData.includes('Test Suites: 0 passed') ||
                  logData.match(/\d+ failing/)
                );
                break;

              case 'vue':
                testPassed = (
                  (logData.includes('Test Files') && logData.includes('passed')) ||
                  logData.includes('✓') ||
                  logData.match(/\d+ passed/) ||
                  logData.includes('All tests passed')
                );
                testFailed = (
                  logData.includes('FAIL') ||
                  logData.includes('✗') ||
                  logData.includes('failed') ||
                  logData.match(/\d+ failed/)
                );
                break;

              case 'javascript':
                testPassed = (
                  (logData.includes('PASS') && logData.includes('test')) ||
                  logData.includes('✓') ||
                  logData.match(/\d+ passing/) ||
                  logData.includes('All tests passed')
                );
                testFailed = (
                  logData.includes('FAIL') ||
                  logData.includes('✗') ||
                  logData.includes('failed') ||
                  logData.match(/\d+ failing/)
                );
                break;
            }

            if (testPassed) {
              hasDetectedTests.current = true;
              if (onTestStateChange) {
                onTestStateChange(true);
              }
              if (testTimeout.current) {
                clearTimeout(testTimeout.current);
                testTimeout.current = null;
              }
            } else if (testFailed) {
              hasDetectedTests.current = true;
              if (onTestStateChange) {
                onTestStateChange(false);
              }
              if (testTimeout.current) {
                clearTimeout(testTimeout.current);
                testTimeout.current = null;
              }
            }
          }
        });
      }
    });

    return () => {
      unsubscribe();
      if (testTimeout.current) {
        clearTimeout(testTimeout.current);
        testTimeout.current = null;
      }
    };
  }, [sandpackClient, onTestStateChange, framework]);
  
  return (
    <div style={{ height: '100%' }}>
      <SandpackTests style={{ height: '100%' }} />
    </div>
  );
};

// Main layout component with status indicators
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework'> & { framework: SupportedFramework }> = ({
  assignmentId,
  questionId,
  onTestComplete,
  framework,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Use refs to prevent unnecessary re-renders
  const submissionInProgress = useRef(false);

  // Reset test results when question changes
  useEffect(() => {
    setTestResults(null);
    setIsSubmitting(false);
    setRunStatus('idle');
    submissionInProgress.current = false;
  }, [assignmentId, questionId]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Handle status changes from the test runner
  const handleStatusChange = useCallback((status: 'idle' | 'running' | 'complete') => {
    setRunStatus(status);
  }, []);

  // Simplified test state change handler
  const handleTestStateChange = useCallback((passed: boolean) => {
    setTestResults({ 
      success: passed, 
      timestamp: Date.now()
    });
    setRunStatus('complete');
  }, []);

  // Memoized test result evaluation
  const allTestsPassed = useMemo(() => {
    return testResults?.success === true;
  }, [testResults]);

  // Get status indicator text and color
  const getStatusInfo = useMemo(() => {
    if (runStatus === 'running') {
      return { 
        text: framework === 'angular' 
          ? '🔄 Compiling Angular app... (this may take up to 15 seconds)' 
          : '🔄 Running tests...', 
        color: '#007bff' 
      };
    } else if (testResults) {
      return {
        text: allTestsPassed ? '✅ All tests passed!' : '❌ Tests failed - check console for errors',
        color: allTestsPassed ? '#28a745' : '#dc3545'
      };
    } else {
      return { text: 'Click the run button (▶️) in Sandpack to test your solution', color: '#666' };
    }
  }, [runStatus, testResults, allTestsPassed, framework]);

  // Optimized submission function with singleton client
  const submitSolution = useCallback(async () => {
    if (!allTestsPassed || submissionInProgress.current) {
      if (!allTestsPassed) {
        showToast('Please ensure all tests are passing before you submit.', 'error');
      }
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    
    try {
      // Clear the auth client to get a fresh one
      authClient = null;
      const client = await getAuthClient();
      
      if (!client) {
        throw new Error('Authentication required');
      }

      const { error: insertError } = await client
        .from('test_results')
        .upsert({
          assignment_id: assignmentId,
          question_id: questionId,
          score: 1,
          passed_test_cases: 1,
          total_test_cases: 1,
          stdout: 'All tests passed',
          stderr: '',
        }, {
          onConflict: 'assignment_id,question_id'
        });

      if (insertError) {
        throw insertError;
      }

      showToast('Solution submitted successfully! 🎉', 'success');
      onTestComplete();
      
    } catch (error) {
      showToast('Failed to submit solution. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
      submissionInProgress.current = false;
    }
  }, [allTestsPassed, assignmentId, questionId, onTestComplete, showToast]);

  return (
    <>
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={closeToast} 
        />
      )}
      
      <SandpackLayout>
        <SandpackCodeEditor style={{ height: '60vh' }} />
        <div style={{ 
          height: '60vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e5e5e5',
          borderLeft: 'none'
        }}>
          <div style={{ 
            padding: '8px 12px',
            borderBottom: '1px solid #e5e5e5',
            backgroundColor: '#f8f9fa',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Test Results ({framework})</span>
            {runStatus === 'running' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#007bff'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #007bff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                {framework === 'angular' ? 'Compiling...' : 'Running...'}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <TestResultsDisplay 
              onTestStateChange={handleTestStateChange}
              onStatusChange={handleStatusChange}
              questionId={questionId}
              framework={framework}
            />
          </div>
        </div>
      </SandpackLayout>
      
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', color: getStatusInfo.color }}>
          {getStatusInfo.text}
        </div>
        <button
          onClick={submitSolution}
          disabled={!allTestsPassed || isSubmitting}
          style={{
            padding: '10px 20px',
            background: !allTestsPassed || isSubmitting ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !allTestsPassed || isSubmitting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Solution'}
        </button>
      </div>

      {/* Add CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

// Helper function to create framework-specific setup files
const createFrameworkFiles = (framework: SupportedFramework, starterCode: string, testCode: string) => {
  const baseFiles: Record<string, { code: string; hidden?: boolean; active?: boolean }> = {};
  
  switch (framework) {
    case 'vue':
      baseFiles['/vite.config.js'] = {
        code: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js']
  }
})`,
        hidden: true
      };
      
      baseFiles['/src/test-setup.js'] = {
        code: `import { vi } from 'vitest'
import '@testing-library/jest-dom'

global.fetch = vi.fn()

beforeEach(() => {
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});`,
        hidden: true
      };

      baseFiles['/src/main.js'] = {
        code: `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`,
        hidden: true
      };

      baseFiles['/index.html'] = {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue 3 App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,
        hidden: true
      };
      break;
      
    case 'angular':
      // Streamlined Angular configuration
      baseFiles['/src/polyfills.ts'] = {
        code: `import 'zone.js';`,
        hidden: true
      };

      baseFiles['/src/main.ts'] = {
        code: `import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));`,
        hidden: true
      };

      // App module with UserService properly registered
      baseFiles['/src/app/app.module.ts'] = {
        code: `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { UserService } from './user.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [UserService],
  bootstrap: [AppComponent]
})
export class AppModule { }`,
        hidden: true
      };

      // Simplified test setup
      baseFiles['/src/test.ts'] = {
        code: `import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// Find all the tests
const context = (require as any).context('./', true, /\.spec\.ts$/);
// And load the modules
context.keys().map(context);`,
        hidden: true
      };

      baseFiles['/src/index.html'] = {
        code: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Angular Test</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <app-root>Loading...</app-root>
</body>
</html>`,
        hidden: true
      };

      baseFiles['/src/styles.css'] = {
        code: `/* Global styles */
.error { 
  color: red; 
  font-size: 12px; 
}

.user-item { 
  display: flex; 
  justify-content: space-between; 
  padding: 10px; 
  border-bottom: 1px solid #eee; 
}

.user-management {
  padding: 20px;
  font-family: Arial, sans-serif;
}

.user-form {
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.user-form div {
  margin-bottom: 15px;
}

.user-form label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.user-form input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-width: 300px;
}

.user-form button {
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.user-form button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.user-list {
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 100px;
}`,
        hidden: true
      };

      // Simplified TypeScript config
      baseFiles['/tsconfig.json'] = {
        code: `{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "outDir": "./dist/out-tsc",
    "strict": false,
    "noImplicitAny": false,
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "sourceMap": true,
    "declaration": false,
    "downlevelIteration": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "target": "ES2020",
    "module": "ES2020",
    "useDefineForClassFields": false,
    "lib": [
      "ES2020",
      "dom"
    ]
  }
}`,
        hidden: true
      };
      break;

    case 'javascript':
      baseFiles['/src/setupTests.js'] = {
        code: `import '@testing-library/jest-dom';
import 'whatwg-fetch';`,
        hidden: true
      };

      baseFiles['/index.html'] = {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JavaScript Test</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.js"></script>
  </body>
</html>`,
        hidden: true
      };
      break;
      
    case 'react':
    default:
      baseFiles['/src/setupTests.js'] = {
        code: `import '@testing-library/jest-dom';
import 'whatwg-fetch';

global.fetch = jest.fn();

beforeEach(() => {
  fetch.mockClear();
});`,
        hidden: true
      };

      baseFiles['/public/index.html'] = {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
        hidden: true
      };

      baseFiles['/src/index.js'] = {
        code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
        hidden: true
      };
      break;
  }
  
  return baseFiles;
};

// Main component - memoized to prevent unnecessary re-renders with key prop
const SandpackTest: React.FC<SandpackTestProps> = React.memo(({
  starterCode,
  testCode,
  framework,
  assignmentId,
  questionId,
  ...rest
}) => {
  const { setup, mainFile, testFile } = useMemo(() => getFrameworkConfig(framework), [framework]);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  const packageJson = useMemo(() => {
    const basePackage = {
      name: `gittalent-${framework}-challenge`,
      version: "0.0.0",
      dependencies: setup.dependencies,
      devDependencies: setup.devDependencies || {},
      scripts: {
        start: framework === 'angular' ? 'ng serve --port 4200' : framework === 'vue' ? 'vite' : framework === 'javascript' ? 'node src/index.js' : 'react-scripts start',
        build: framework === 'angular' ? 'ng build' : framework === 'vue' ? 'vite build' : framework === 'javascript' ? 'echo "No build needed"' : 'react-scripts build',
        test: framework === 'angular' ? 'jasmine src/**/*.spec.ts' : framework === 'vue' ? 'vitest --run' : 'jest --watchAll=false'
      },
    };

    // Framework-specific configurations
    switch (framework) {
      case 'angular':
        // Simplified Angular package configuration
        basePackage.scripts.test = 'echo "Tests run automatically"';
        break;
      case 'javascript':
        basePackage.jest = {
          testEnvironment: 'jsdom',
          setupFilesAfterEnv: ['<rootDir>/src/setupTests.js']
        };
        break;
    }

    return JSON.stringify(basePackage, null, 2);
  }, [framework, setup]);

  const files = useMemo(() => {
    const frameworkFiles = createFrameworkFiles(framework, starterCode, testCode);
    
    // For Angular, we need to create a proper test file that sets up the testing module
    if (framework === 'angular' && testCode) {
      const angularTestCode = `import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { UserService } from './user.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: any;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('UserService', ['getUsers', 'addUser', 'deleteUser']);

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: UserService, useValue: spy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    userService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;

    // Setup default spy returns
    userService.getUsers.and.returnValue(of([
      { id: 1, name: 'Test User', email: 'test@example.com' }
    ]));
    userService.addUser.and.returnValue(of({ id: 2, name: 'New User', email: 'new@example.com' }));
    userService.deleteUser.and.returnValue(of(true));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    console.log('Component created successfully');
  });

  it('should load users on init', () => {
    fixture.detectChanges();
    expect(userService.getUsers).toHaveBeenCalled();
    console.log('Users loaded on initialization');
  });

  it('should validate form fields', () => {
    fixture.detectChanges();
    
    // Check that form is initially invalid
    expect(component.userForm.valid).toBeFalsy();
    
    // Set valid values
    component.userForm.patchValue({
      name: 'Test User',
      email: 'test@example.com'
    });
    
    expect(component.userForm.valid).toBeTruthy();
    console.log('Form validation working correctly');
  });

  it('should add user on form submit', () => {
    fixture.detectChanges();
    
    // Set form values
    component.userForm.patchValue({
      name: 'New User',
      email: 'new@example.com'
    });
    
    // Submit form
    component.onSubmit();
    
    expect(userService.addUser).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.com'
    });
    console.log('User add functionality working');
  });
});`;

      frameworkFiles[testFile] = {
        code: angularTestCode,
        hidden: true
      };
    }
    
    return {
      [mainFile]: { 
        code: starterCode, 
        active: true 
      },
      [testFile]: { 
        code: framework === 'angular' ? frameworkFiles[testFile].code : testCode, 
        hidden: true 
      },
      '/package.json': { 
        code: packageJson, 
        hidden: true 
      },
      ...frameworkFiles,
    };
  }, [framework, starterCode, testCode, mainFile, testFile, packageJson]);

  // Use a key that changes when the question changes to force remount
  const sandpackKey = useMemo(() => 
    `${assignmentId}-${questionId}-${framework}`, 
    [assignmentId, questionId, framework]
  );

  // Framework-specific Sandpack options
  const getSandpackOptions = useCallback(() => {
    const baseOptions = {
      autorun: false,  // Prevent auto-running for all frameworks
      autoReload: false, // Prevent auto-reloading for all frameworks
      initMode: 'user-visible' as const,
      logLevel: 'info' as const,
      recompileMode: 'delayed' as const,
    };

    switch (framework) {
      case 'angular':
        return {
          ...baseOptions,
          recompileDelay: 3000, // Longer delay for Angular compilation
          bundlerURL: undefined, // Use default bundler for Angular
        };
      
      case 'vue':
        return {
          ...baseOptions,
          recompileDelay: 1000,
          bundlerURL: undefined,
        };
      
      case 'react':
        return {
          ...baseOptions,
          recompileDelay: 500,
          bundlerURL: undefined,
        };
      
      case 'javascript':
        return {
          ...baseOptions,
          recompileDelay: 300,
          bundlerURL: undefined,
        };
      
      default:
        return {
          ...baseOptions,
          recompileDelay: 500,
        };
    }
  }, [framework]);

  return (
    <SandpackProvider 
      key={sandpackKey}
      customSetup={setup} 
      files={files} 
      options={getSandpackOptions()}
    >
      <SandpackLayoutManager 
        assignmentId={assignmentId} 
        questionId={questionId} 
        framework={framework}
        {...rest} 
      />
    </SandpackProvider>
  );
});

SandpackTest.displayName = 'SandpackTest';

export default SandpackTest;
