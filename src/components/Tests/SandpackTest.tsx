import React, { useState, useEffect, useMemo } from 'react';
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

// Simple inline toast notification component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ 
  message, 
  type, 
  onClose 
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
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
type SupportedFramework = 'react' | 'vue' | 'angular';

// Define the shape of the props for the component
interface SandpackTestProps {
  starterCode: string;
  testCode: string | undefined | null; // test_code can be nullable
  framework: SupportedFramework;
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void; // Callback to notify parent
}

// --- Framework Configurations ---
// This section defines the setup for each framework

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
            '@angular/animations': '^15.2.0',
            '@angular/common': '^15.2.0',
            '@angular/compiler': '^15.2.0',
            '@angular/core': '^15.2.0',
            '@angular/forms': '^15.2.0',
            '@angular/platform-browser': '^15.2.0',
            '@angular/platform-browser-dynamic': '^15.2.0',
            'rxjs': '^7.8.0',
            'zone.js': '^0.12.0',
            'tslib': '^2.5.0',
          },
          devDependencies: {
            '@angular/core/testing': '^15.2.0',
            '@angular/common/testing': '^15.2.0',
            '@angular/platform-browser/testing': '^15.2.0',
            'jasmine-core': '^4.5.0',
            'typescript': '^4.9.5',
            '@types/jasmine': '^4.3.0',
          },
          template: 'angular',
        },
        mainFile: '/src/app/app.component.ts',
        testFile: '/src/app/app.component.spec.ts',
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
        },
        mainFile: '/App.js',
        testFile: '/App.test.js',
      };
  }
};

import { SandpackTestsProps } from '@codesandbox/sandpack-react';

// Child component that contains the UI and logic which depends on the Sandpack context
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework'> & { 
  testCode: string;
  testFile: string;
}> = ({
  assignmentId,
  questionId,
  onTestComplete,
  testCode,
  testFile,
}) => {
  const { sandpack } = useSandpack();
  const [testResults, setTestResults] = useState<SandpackTestsProps | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testsActive, setTestsActive] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const runTests = async () => {
    try {
      // First, add the test file to the sandpack environment
      sandpack.updateFile(testFile, testCode);
      
      // Set tests as active
      setTestsActive(true);
      
      // Add a small delay to ensure the file system is updated
      setTimeout(() => {
        // Force a refresh of the sandpack environment to trigger tests
        sandpack.runSandpack();
      }, 200);
    } catch (error) {
      console.error('Error running tests:', error);
      showToast('Error running tests', 'error');
    }
  };

  const handleTestComplete = (payload: SandpackTestsProps) => {
    setTestResults(payload);
  };

  const submitSolution = async () => {
    if (!allTestsPassed) {
      showToast('Please ensure all tests are passing before you submit.', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('=== ENHANCED AUTHENTICATION DEBUG ===');
      
      // Get current user and session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      console.log('User:', user?.id);
      console.log('Session exists:', !!sessionData.session);
      console.log('Access token exists:', !!sessionData.session?.access_token);
      
      if (!user || !sessionData.session) {
        showToast('Authentication required! Please log in and try again.', 'error');
        return;
      }

      // Test 1: Check if auth.uid() works via RPC
      console.log('\n=== TEST 1: auth.uid() via RPC ===');
      const { data: authUidTest, error: authUidError } = await supabase.rpc('test_auth_uid');
      console.log('auth.uid() result:', authUidTest);
      console.log('auth.uid() error:', authUidError);
      
      // Test 2: Comprehensive auth context debug
      console.log('\n=== TEST 2: Comprehensive Auth Debug ===');
      const { data: debugAuth, error: debugError } = await supabase.rpc('debug_auth_context');
      console.log('Auth context debug:', debugAuth);
      console.log('Auth context error:', debugError);
      
      // Test 3: Test insert conditions
      console.log('\n=== TEST 3: Insert Conditions Test ===');
      const { data: insertTest, error: insertTestError } = await supabase.rpc('test_insert_auth', {
        p_assignment_id: assignmentId,
        p_question_id: questionId
      });
      console.log('Insert test result:', insertTest);
      console.log('Insert test error:', insertTestError);
      
      // Test 4: Try with explicit auth header (potential fix)
      console.log('\n=== TEST 4: Explicit Auth Header Test ===');
      try {
        // Create a new client instance with explicit headers
        const { createClient } = await import('@supabase/supabase-js');
        const explicitAuthClient = createClient(
          supabase.supabaseUrl,
          supabase.supabaseKey,
          {
            global: {
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
            },
            auth: {
              persistSession: false, // Don't persist for this test
            },
          }
        );

        // Test auth.uid() with explicit client
        const { data: explicitAuthTest, error: explicitAuthError } = await explicitAuthClient.rpc('test_auth_uid');
        console.log('Explicit auth test result:', explicitAuthTest);
        console.log('Explicit auth error:', explicitAuthError);

        // If explicit auth works, try the insert with it
        if (explicitAuthTest && !explicitAuthError) {
          console.log('✅ Explicit auth works! Trying insert...');
          
          let passed_test_cases = 0;
          let total_test_cases = 0;

          if (testResults && typeof testResults === 'object') {
            for (const fileName in testResults) {
              const fileResults = testResults[fileName];
              if (fileResults && fileResults.tests) {
                const testCases = Object.values(fileResults.tests);
                total_test_cases += testCases.length;
                passed_test_cases += testCases.filter(t => t.status === 'pass').length;
              }
            }
          }
          
          const { error: explicitInsertError } = await explicitAuthClient
            .from('test_results')
            .upsert({
              assignment_id: assignmentId,
              question_id: questionId,
              score: 1,
              passed_test_cases: passed_test_cases,
              total_test_cases: total_test_cases,
              stdout: JSON.stringify(testResults, null, 2),
              stderr: '',
            }, {
              onConflict: 'assignment_id,question_id'
            });

          if (explicitInsertError) {
            console.error('❌ Explicit insert failed:', explicitInsertError);
          } else {
            console.log('✅ SUCCESS! Explicit auth insert worked!');
            showToast('Solution submitted successfully! 🎉', 'success');
            onTestComplete();
            return;
          }
        }
      } catch (explicitError) {
        console.error('Explicit auth test failed:', explicitError);
      }

      // Test 5: Force session refresh and retry
      console.log('\n=== TEST 5: Force Session Refresh ===');
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        console.log('Session refresh result:', !!refreshData.session);
        console.log('Session refresh error:', refreshError);

        if (refreshData.session && !refreshError) {
          console.log('✅ Session refreshed, trying regular insert...');
          
          let passed_test_cases = 0;
          let total_test_cases = 0;

          if (testResults && typeof testResults === 'object') {
            for (const fileName in testResults) {
              const fileResults = testResults[fileName];
              if (fileResults && fileResults.tests) {
                const testCases = Object.values(fileResults.tests);
                total_test_cases += testCases.length;
                passed_test_cases += testCases.filter(t => t.status === 'pass').length;
              }
            }
          }

          const { error: refreshedInsertError } = await supabase
            .from('test_results')
            .upsert({
              assignment_id: assignmentId,
              question_id: questionId,
              score: 1,
              passed_test_cases: passed_test_cases,
              total_test_cases: total_test_cases,
              stdout: JSON.stringify(testResults, null, 2),
              stderr: '',
            }, {
              onConflict: 'assignment_id,question_id'
            });

          if (refreshedInsertError) {
            console.error('❌ Insert after refresh failed:', refreshedInsertError);
          } else {
            console.log('✅ SUCCESS! Insert after refresh worked!');
            showToast('Solution submitted successfully! 🎉', 'success');
            onTestComplete();
            return;
          }
        }
      } catch (refreshError) {
        console.error('Session refresh failed:', refreshError);
      }

      // If we get here, all methods failed
      console.log('\n=== ALL METHODS FAILED ===');
      console.log('Summary of auth context issues:');
      console.log('1. Standard auth.uid():', authUidTest);
      console.log('2. Auth debug:', debugAuth);
      console.log('3. Insert test:', insertTest);
      
      throw new Error('Authentication context not working - all methods failed');
      
    } catch (error) {
      console.error('Failed to submit solution:', error);
      showToast('There was an error submitting your solution. Please check the console for details.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allTestsPassed = useMemo(() => {
    if (!testResults || typeof testResults !== 'object') return false;

    // Iterate over each test file in the results
    for (const fileName in testResults) {
      const fileResults = testResults[fileName];
      if (fileResults && fileResults.tests) {
        // Iterate over each test case in the file
        for (const testName in fileResults.tests) {
          if (fileResults.tests[testName].status !== 'pass') {
            return false; // If any test has not passed, return false
          }
        }
      }
    }
    // If all tests in all files have passed
    return Object.keys(testResults).length > 0;
  }, [testResults]);

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
        <div style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '8px 12px',
            borderBottom: '1px solid #e5e5e5',
            backgroundColor: '#f8f9fa'
          }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Tests</h4>
            <button 
              onClick={runTests} 
              style={{ 
                padding: '6px 12px', 
                background: '#007bff', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              Run Tests
            </button>
          </div>
          {testsActive ? (
            <div style={{ flex: 1 }}>
              <SandpackTests
                style={{ height: '100%', border: 'none' }}
                onComplete={handleTestComplete}
              />
            </div>
          ) : (
            <div 
              style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#6b7280',
                fontSize: '14px',
                backgroundColor: '#fafafa'
              }}
            >
              Click "Run Tests" to execute your tests
            </div>
          )}
        </div>
      </SandpackLayout>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
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
    </>
  );
};

// Helper function to create framework-specific setup files
const createFrameworkFiles = (framework: SupportedFramework, starterCode: string, testCode: string) => {
  const baseFiles: Record<string, { code: string; hidden?: boolean; active?: boolean }> = {};
  
  switch (framework) {
    case 'vue':
      // Vue 3 setup with Vite and Vitest
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

// Mock fetch if needed
global.fetch = vi.fn()

// Setup before each test
beforeEach(() => {
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});`,
        hidden: true
      };

      // Vue 3 main entry point
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
      // Simplified Angular setup - no angular.json needed for Sandpack
      baseFiles['/src/environments/environment.ts'] = {
        code: `export const environment = {
  production: false
};`,
        hidden: true
      };

      // Simplified TypeScript config for Sandpack
      baseFiles['/tsconfig.json'] = {
        code: JSON.stringify({
          "compilerOptions": {
            "target": "ES2020",
            "lib": ["ES2020", "dom"],
            "module": "ES2020",
            "moduleResolution": "node",
            "experimentalDecorators": true,
            "emitDecoratorMetadata": true,
            "strict": false,
            "esModuleInterop": true,
            "skipLibCheck": true,
            "allowSyntheticDefaultImports": true,
            "useDefineForClassFields": false
          }
        }, null, 2),
        hidden: true
      };

      // Simplified Angular polyfills
      baseFiles['/src/polyfills.ts'] = {
        code: `import 'zone.js';`,
        hidden: true
      };

      // Angular main bootstrap
      baseFiles['/src/main.ts'] = {
        code: `import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));`,
        hidden: true
      };

      // Simplified Angular app module
      baseFiles['/src/app/app.module.ts'] = {
        code: `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }`,
        hidden: true
      };

      // Simplified test setup for Sandpack
      baseFiles['/src/test.ts'] = {
        code: `import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);`,
        hidden: true
      };

      // Simplified Index.html
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
  <app-root></app-root>
</body>
</html>`,
        hidden: true
      };
      break;
      
    case 'react':
    default:
      // React setup with additional test utilities
      baseFiles['/src/setupTests.js'] = {
        code: `import '@testing-library/jest-dom';
import 'whatwg-fetch';

// Mock fetch for testing
global.fetch = jest.fn();

// Setup before each test
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

// Main (Parent) component responsible for setting up the Provider
const SandpackTest: React.FC<SandpackTestProps> = ({
  starterCode,
  testCode,
  framework,
  ...rest
}) => {
  const { setup, mainFile, testFile } = getFrameworkConfig(framework);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  const packageJson = JSON.stringify({
    name: `gittalent-${framework}-challenge`,
    version: "0.0.0",
    dependencies: setup.dependencies,
    devDependencies: setup.devDependencies || {},
    scripts: { 
      start: framework === 'angular' ? 'ng serve' : framework === 'vue' ? 'vite' : 'react-scripts start',
      build: framework === 'angular' ? 'ng build' : framework === 'vue' ? 'vite build' : 'react-scripts build',
      test: framework === 'angular' ? 'ng test' : framework === 'vue' ? 'vitest' : 'react-scripts test'
    },
  }, null, 2);

  // Create framework-specific setup files
  const frameworkFiles = createFrameworkFiles(framework, starterCode, testCode);

  // Initially exclude the test file - it will be added dynamically when tests are run
  const files = {
    [mainFile]: { code: starterCode, active: true },
    '/package.json': { code: packageJson, hidden: true },
    ...frameworkFiles,
    // Test file is NOT included initially
  };

  return (
    <SandpackProvider 
      customSetup={setup} 
      files={files} 
      options={{ 
        autorun: false,
        autoReload: false,
        initMode: 'lazy'
      }}
    >
      <SandpackLayoutManager 
        {...rest} 
        testCode={testCode}
        testFile={testFile}
      />
    </SandpackProvider>
  );
};

export default SandpackTest;
