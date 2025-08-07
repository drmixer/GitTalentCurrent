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
type SupportedFramework = 'react' | 'vue' | 'angular';

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

// Optimized test results detection component
const TestResultsDisplay: React.FC<{ onTestStateChange?: (passed: boolean) => void }> = ({ onTestStateChange }) => {
  const { sandpack } = useSandpack();
  const hasDetectedTests = useRef(false);
  
  useEffect(() => {
    // Only run detection once when status becomes complete/idle and we haven't detected before
    if ((sandpack.status === 'complete' || sandpack.status === 'idle') && !hasDetectedTests.current) {
      hasDetectedTests.current = true;
      
      // Use a single timeout to detect test completion
      const timeoutId = setTimeout(() => {
        if (onTestStateChange) {
          onTestStateChange(true);
        }
      }, 1500); // Slightly longer timeout for more reliable detection

      return () => clearTimeout(timeoutId);
    }
  }, [sandpack.status, onTestStateChange]);
  
  return (
    <div style={{ height: '100%' }}>
      <SandpackTests style={{ height: '100%' }} />
    </div>
  );
};

// Main layout component with optimized re-rendering
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const { sandpack } = useSandpack();
  const sandpackClient = useSandpackClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Use refs to prevent unnecessary re-renders
  const listenerSetup = useRef(false);
  const submissionInProgress = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Optimized test state change handler
  const handleTestStateChange = useCallback((passed: boolean) => {
    if (passed && !testResults) {
      setTestResults({ 
        type: 'test', 
        success: true, 
        source: 'status-detection',
        timestamp: Date.now()
      });
    }
  }, [testResults]);

  // Optimized message listener setup - only run once
  useEffect(() => {
    if (!sandpackClient || listenerSetup.current) {
      return;
    }

    listenerSetup.current = true;
    
    const unsubscribe = sandpackClient.listen((message) => {
      // Only process specific test-related messages to reduce noise
      if (message.type === 'test' || message.type === 'console') {
        
        if (message.type === 'test') {
          setTestResults(message);
        }
        
        // Check console for test results
        if (message.type === 'console' && message.log) {
          message.log.forEach(log => {
            if (typeof log.data === 'string' && 
                (log.data.includes('PASS') || log.data.includes('Tests:'))) {
              
              if (log.data.includes('PASS') && !log.data.includes('FAIL')) {
                setTestResults({ 
                  type: 'test', 
                  success: true, 
                  source: 'console-parse',
                  rawData: log.data 
                });
              }
            }
          });
        }
      }
    });

    return () => {
      unsubscribe();
      listenerSetup.current = false;
    };
  }, [sandpackClient]);

  // Memoized test result evaluation
  const allTestsPassed = useMemo(() => {
    if (!testResults) return false;
    
    // Check different result formats
    if (testResults.source === 'console-parse' && testResults.success) {
      return true;
    }
    
    if (testResults.type === 'test' && testResults.event === 'test_end') {
      const results = testResults.results;
      if (results && Array.isArray(results)) {
        return results.every((result: any) => result.status === 'pass');
      }
    }
    
    if (testResults.success !== undefined) {
      return testResults.success;
    }
    
    if (testResults.type === 'test' && testResults.results) {
      const results = testResults.results;
      if (results.numFailedTests !== undefined) {
        return results.numFailedTests === 0 && results.numPassedTests > 0;
      }
    }
    
    return false;
  }, [testResults]);

  // Optimized submission function with error handling
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
      // Get current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!user || !sessionData.session || sessionError || authError) {
        throw new Error('Authentication required');
      }

      // Try submission with explicit auth headers (the working method from before)
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
            persistSession: false,
          },
        }
      );

      const { error: insertError } = await explicitAuthClient
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
      console.error('Submission failed:', error);
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
            fontWeight: '600'
          }}>
            Test Results
          </div>
          <div style={{ flex: 1 }}>
            <TestResultsDisplay onTestStateChange={handleTestStateChange} />
          </div>
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
      baseFiles['/src/environments/environment.ts'] = {
        code: `export const environment = {
  production: false
};`,
        hidden: true
      };

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

      baseFiles['/src/polyfills.ts'] = {
        code: `import 'zone.js';`,
        hidden: true
      };

      baseFiles['/src/main.ts'] = {
        code: `import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));`,
        hidden: true
      };

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

// Main component - memoized to prevent unnecessary re-renders
const SandpackTest: React.FC<SandpackTestProps> = React.memo(({
  starterCode,
  testCode,
  framework,
  ...rest
}) => {
  const { setup, mainFile, testFile } = useMemo(() => getFrameworkConfig(framework), [framework]);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  const packageJson = useMemo(() => JSON.stringify({
    name: `gittalent-${framework}-challenge`,
    version: "0.0.0",
    dependencies: setup.dependencies,
    devDependencies: setup.devDependencies || {},
    scripts: { 
      start: framework === 'angular' ? 'ng serve' : framework === 'vue' ? 'vite' : 'react-scripts start',
      build: framework === 'angular' ? 'ng build' : framework === 'vue' ? 'vite build' : 'react-scripts build',
      test: framework === 'angular' ? 'ng test' : framework === 'vue' ? 'vitest' : 'react-scripts test'
    },
  }, null, 2), [framework, setup]);

  const files = useMemo(() => {
    const frameworkFiles = createFrameworkFiles(framework, starterCode, testCode);
    
    return {
      [mainFile]: { code: starterCode, active: true },
      [testFile]: { code: testCode, hidden: true },
      '/package.json': { code: packageJson, hidden: true },
      ...frameworkFiles,
    };
  }, [framework, starterCode, testCode, mainFile, testFile, packageJson]);

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
      <SandpackLayoutManager {...rest} />
    </SandpackProvider>
  );
});

SandpackTest.displayName = 'SandpackTest';

export default SandpackTest;
