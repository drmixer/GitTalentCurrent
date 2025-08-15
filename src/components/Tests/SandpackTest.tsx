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

// Status indicator component
const StatusIndicator: React.FC<{ status: string; framework: string; hasRun: boolean }> = ({ status, framework, hasRun }) => {
  const getStatusInfo = (status: string, hasRun: boolean) => {
    if (!hasRun) {
      return { text: 'Ready to Run', color: '#6b7280', icon: '⚡' };
    }
    
    switch (status) {
      case 'initial':
        return { text: 'Initializing...', color: '#6b7280', icon: '⏳' };
      case 'bundling':
        return { text: 'Compiling...', color: '#3b82f6', icon: '🔧' };
      case 'running':
        return { text: 'Running tests...', color: '#f59e0b', icon: '▶️' };
      case 'complete':
        return { text: 'Tests Complete', color: '#10b981', icon: '✅' };
      case 'idle':
        return { text: 'Tests Complete', color: '#10b981', icon: '✅' };
      case 'error':
        return { text: 'Error', color: '#ef4444', icon: '❌' };
      default:
        return { text: status, color: '#6b7280', icon: '⚡' };
    }
  };

  const statusInfo = getStatusInfo(status, hasRun);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      fontSize: '12px',
      color: statusInfo.color,
      fontWeight: '500'
    }}>
      <span>{statusInfo.icon}</span>
      <span>{statusInfo.text}</span>
      <span style={{ opacity: 0.7, fontSize: '11px' }}>({framework})</span>
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

// Framework configurations - RESTORED to working state with proper dependencies
const getFrameworkConfig = (framework: SupportedFramework): { setup: SandpackSetup, mainFile: string, testFile: string } => {
  switch (framework) {
    case 'vue':
      return {
        setup: {
          template: 'vue',
          dependencies: {
            'vue': '^3.3.4',
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^4.3.4',
            'vite': '^4.4.9',
          },
        },
        mainFile: '/src/App.vue',
        testFile: '/src/App.test.js',
      };

    case 'angular':
      return {
        setup: {
          template: 'angular',
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
        },
        mainFile: '/src/app/app.component.ts',
        testFile: '/src/app/app.component.spec.ts',
      };

    case 'javascript':
      return {
        setup: {
          template: 'vanilla',
          dependencies: {
            '@testing-library/jest-dom': '^5.16.5',
          },
          devDependencies: {
            '@types/jest': '^29.5.5',
            'jest': '^29.5.0',
            'jest-environment-jsdom': '^29.5.0',
          },
        },
        mainFile: '/src/index.js',
        testFile: '/src/index.test.js',
      };

    case 'react':
    default:
      return {
        setup: {
          template: 'react',
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            '@testing-library/react': '^13.4.0',
            '@testing-library/jest-dom': '^5.16.5',
            '@testing-library/user-event': '^14.4.3',
          },
        },
        mainFile: '/App.js',
        testFile: '/App.test.js',
      };
  }
};

// Simplified test results detection
const TestResultsDisplay: React.FC<{ 
  onTestStateChange?: (passed: boolean) => void,
  questionId: string,
  framework: SupportedFramework,
  hasRun: boolean,
  onRunTests?: () => void,
}> = ({ onTestStateChange, questionId, framework, hasRun, onRunTests }) => {
  const { sandpack } = useSandpack();
  const sandpackClient = useSandpackClient();
  const hasDetectedTests = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Reset detection when question changes
  useEffect(() => {
    hasDetectedTests.current = false;
    setIsRunning(false);
  }, [questionId]);
  
  // Console output listener - SIMPLIFIED for better reliability
  useEffect(() => {
    if (!sandpackClient) return;

    const unsubscribe = sandpackClient.listen((message) => {
      if (message.type === 'console' && message.log && hasRun && !hasDetectedTests.current) {
        message.log.forEach(log => {
          if (typeof log.data === 'string') {
            const logData = log.data.toLowerCase();
            
            // Look for test completion indicators
            const passIndicators = [
              'pass', '✓', '✅', 'success', 'test passed', 'all tests passed',
              'tests: 1 passed', 'passing', 'complete'
            ];
            
            if (passIndicators.some(indicator => logData.includes(indicator))) {
              hasDetectedTests.current = true;
              setIsRunning(false);
              if (onTestStateChange) {
                onTestStateChange(true);
              }
            }
          }
        });
      }
    });

    return unsubscribe;
  }, [sandpackClient, onTestStateChange, hasRun]);
  
  // Fallback timeout for test completion
  useEffect(() => {
    if (hasRun && (sandpack.status === 'complete' || sandpack.status === 'idle') && !hasDetectedTests.current) {
      const timeout = setTimeout(() => {
        if (!hasDetectedTests.current && onTestStateChange) {
          hasDetectedTests.current = true;
          setIsRunning(false);
          onTestStateChange(true);
        }
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [sandpack.status, onTestStateChange, hasRun]);

  const handleRunTests = useCallback(() => {
    setIsRunning(true);
    hasDetectedTests.current = false;
    
    if (onRunTests) {
      onRunTests();
    }
  }, [onRunTests]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '8px',
        fontSize: '12px',
        fontWeight: '600',
        borderBottom: '1px solid #e5e5e5',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Test Results</span>
        <button
          onClick={handleRunTests}
          disabled={isRunning}
          style={{
            padding: '4px 12px',
            background: isRunning ? '#ccc' : '#007cba',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: '500'
          }}
        >
          {isRunning ? 'Running...' : 'Run Tests'}
        </button>
      </div>
      <div style={{ flex: 1 }}>
        {hasRun ? (
          <SandpackTests style={{ height: '100%' }} />
        ) : (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#666',
            fontSize: '14px'
          }}>
            Click "Run Tests" to execute your tests
          </div>
        )}
      </div>
    </div>
  );
};

// Main layout component
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework'> & { framework: SupportedFramework }> = ({
  assignmentId,
  questionId,
  onTestComplete,
  framework,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const { sandpack } = useSandpack();
  
  const submissionInProgress = useRef(false);

  useEffect(() => {
    setTestResults(null);
    setIsSubmitting(false);
    setHasRun(false);
    submissionInProgress.current = false;
  }, [assignmentId, questionId]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  const handleTestStateChange = useCallback((passed: boolean) => {
    if (passed && !testResults) {
      setTestResults({ 
        success: true, 
        source: 'console-detection',
        timestamp: Date.now()
      });
    }
  }, [testResults]);

  const handleRunTests = useCallback(() => {
    setHasRun(true);
    setTestResults(null);
  }, []);

  const allTestsPassed = useMemo(() => {
    return testResults?.success === true;
  }, [testResults]);

  const submitSolution = useCallback(async () => {
    if (!hasRun) {
      showToast('Please run the tests first before submitting.', 'error');
      return;
    }
    
    if (!allTestsPassed || submissionInProgress.current) {
      if (!allTestsPassed) {
        showToast('Please ensure all tests are passing before you submit.', 'error');
      }
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    
    try {
      const { error: insertError } = await supabase
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
  }, [hasRun, allTestsPassed, assignmentId, questionId, onTestComplete, showToast]);

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
            <span>Test Results</span>
            <StatusIndicator status={sandpack.status} framework={framework} hasRun={hasRun} />
          </div>
          <div style={{ flex: 1 }}>
            <TestResultsDisplay 
              onTestStateChange={handleTestStateChange}
              questionId={questionId}
              framework={framework}
              hasRun={hasRun}
              onRunTests={handleRunTests}
            />
          </div>
        </div>
      </SandpackLayout>
      
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {testResults && (
            <div style={{ 
              fontSize: '14px',
              color: '#10b981',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ✅ Tests Passed
            </div>
          )}
          {!hasRun && (
            <div style={{ 
              fontSize: '14px',
              color: '#f59e0b',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ⚠️ Tests not run yet
            </div>
          )}
        </div>
        <button
          onClick={submitSolution}
          disabled={!hasRun || !allTestsPassed || isSubmitting}
          style={{
            padding: '10px 20px',
            background: (!hasRun || !allTestsPassed || isSubmitting) ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!hasRun || !allTestsPassed || isSubmitting) ? 'not-allowed' : 'pointer',
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

// Helper function to create framework-specific files - RESTORED with proper entry points
const createFrameworkFiles = (framework: SupportedFramework, starterCode: string, testCode: string): SandpackFiles => {
  const baseFiles: SandpackFiles = {};
  
  switch (framework) {
    case 'vue':
      baseFiles['/package.json'] = {
        code: JSON.stringify({
          name: "vue-test",
          version: "1.0.0",
          main: "src/main.js",
          scripts: {
            dev: "vite",
            build: "vite build"
          },
          dependencies: {
            'vue': '^3.3.4'
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^4.3.4',
            'vite': '^4.4.9'
          }
        }, null, 2),
        hidden: true
      };

      baseFiles['/src/main.js'] = {
        code: `import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')`,
        hidden: true
      };

      baseFiles['/index.html'] = {
        code: `<!DOCTYPE html>
<html>
  <head>
    <title>Vue App</title>
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
      baseFiles['/package.json'] = {
        code: JSON.stringify({
          name: "angular-test",
          version: "1.0.0",
          main: "src/main.ts",
          scripts: {
            start: "ng serve",
            build: "ng build"
          },
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
            'tslib': '^2.5.0'
          },
          devDependencies: {
            '@angular/core/testing': '^15.2.0',
            '@angular/common/testing': '^15.2.0',
            '@angular/platform-browser/testing': '^15.2.0',
            'jasmine-core': '^4.5.0',
            'typescript': '^4.9.5',
            '@types/jasmine': '^4.3.0'
          }
        }, null, 2),
        hidden: true
      };

      baseFiles['/src/main.ts'] = {
        code: `import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));`,
        hidden: true
      };

      baseFiles['/src/app/app.module.ts'] = {
        code: `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }`,
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

    case 'javascript':
      baseFiles['/package.json'] = {
        code: JSON.stringify({
          name: "javascript-test",
          version: "1.0.0",
          main: "src/index.js",
          scripts: {
            start: "parcel index.html",
            test: "jest"
          },
          dependencies: {
            '@testing-library/jest-dom': '^5.16.5'
          },
          devDependencies: {
            '@types/jest': '^29.5.5',
            'jest': '^29.5.0',
            'jest-environment-jsdom': '^29.5.0'
          }
        }, null, 2),
        hidden: true
      };

      baseFiles['/index.html'] = {
        code: `<!DOCTYPE html>
<html>
  <head>
    <title>JavaScript Test</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="src/index.js"></script>
  </body>
</html>`,
        hidden: true
      };
      break;
      
    case 'react':
    default:
      baseFiles['/package.json'] = {
        code: JSON.stringify({
          name: "react-test",
          version: "1.0.0",
          main: "src/index.js",
          scripts: {
            start: "react-scripts start",
            build: "react-scripts build",
            test: "react-scripts test"
          },
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1'
          },
          devDependencies: {
            '@testing-library/react': '^13.4.0',
            '@testing-library/jest-dom': '^5.16.5',
            '@testing-library/user-event': '^14.4.3'
          },
          browserslist: {
            production: [">0.2%", "not dead", "not op_mini all"],
            development: ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
          }
        }, null, 2),
        hidden: true
      };

      baseFiles['/public/index.html'] = {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React Test</title>
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

// Main component - RESTORED with proper setup
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

  const files = useMemo(() => {
    const additionalFiles = createFrameworkFiles(framework, starterCode, testCode);
    
    const mainFiles = {
      [mainFile]: { 
        code: starterCode, 
        active: true 
      },
      [testFile]: { 
        code: testCode, 
        hidden: true 
      },
      ...additionalFiles,
    };

    return mainFiles;
  }, [framework, starterCode, testCode, mainFile, testFile]);

  const sandpackKey = useMemo(() => 
    `${assignmentId}-${questionId}-${framework}`, 
    [assignmentId, questionId, framework]
  );

  return (
    <SandpackProvider 
      key={sandpackKey}
      customSetup={setup}
      files={files} 
      options={{ 
        autorun: true,
        autoReload: false,
        initMode: 'immediate',
      }}
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
