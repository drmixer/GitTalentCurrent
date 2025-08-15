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
            '@angular/router': '^16.0.0',
            'rxjs': '^7.8.0',
            'zone.js': '^0.13.0',
            'tslib': '^2.5.0',
          },
          devDependencies: {
            '@angular/testing': '^16.0.0',
            '@angular/core/testing': '^16.0.0',
            '@angular/common/testing': '^16.0.0',
            '@angular/platform-browser/testing': '^16.0.0',
            'jasmine-core': '^4.6.0',
            'typescript': '^5.0.0',
            '@types/jasmine': '^4.3.0',
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
        },
        mainFile: '/App.js',
        testFile: '/App.test.js',
      };
  }
};

// Simplified test results detection component
const TestResultsDisplay: React.FC<{ 
  onTestStateChange?: (passed: boolean) => void,
  questionId: string 
}> = ({ onTestStateChange, questionId }) => {
  const { sandpack } = useSandpack();
  const sandpackClient = useSandpackClient();
  const hasDetectedTests = useRef(false);
  
  // Reset detection when question changes
  useEffect(() => {
    hasDetectedTests.current = false;
  }, [questionId]);
  
  // Listen for test completion messages from Sandpack
  useEffect(() => {
    if (!sandpackClient) return;

    const unsubscribe = sandpackClient.listen((message) => {
      // Listen for test completion messages
      if (message.type === 'test' && message.event === 'test_end' && !hasDetectedTests.current) {
        hasDetectedTests.current = true;
        const results = message.results;
        if (results && Array.isArray(results)) {
          const allPassed = results.every((result: any) => result.status === 'pass');
          if (onTestStateChange) {
            onTestStateChange(allPassed);
          }
        }
      }
      
      // Listen for console messages that might indicate test results
      if (message.type === 'console' && message.log && !hasDetectedTests.current) {
        message.log.forEach(log => {
          if (typeof log.data === 'string') {
            // Look for test success indicators
            if (log.data.includes('✓') || 
                log.data.includes('PASS') ||
                (log.data.includes('Tests:') && log.data.includes('passed')) ||
                log.data.includes('All tests passed')) {
              hasDetectedTests.current = true;
              if (onTestStateChange) {
                onTestStateChange(true);
              }
            }
            // Look for test failure indicators
            else if (log.data.includes('FAIL') || 
                     log.data.includes('✗') ||
                     log.data.includes('failed')) {
              hasDetectedTests.current = true;
              if (onTestStateChange) {
                onTestStateChange(false);
              }
            }
          }
        });
      }
    });

    return unsubscribe;
  }, [sandpackClient, onTestStateChange]);
  
  return (
    <div style={{ height: '100%' }}>
      <SandpackTests style={{ height: '100%' }} />
    </div>
  );
};

// Main layout component with simplified logic
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Use refs to prevent unnecessary re-renders
  const submissionInProgress = useRef(false);

  // Reset test results when question changes
  useEffect(() => {
    setTestResults(null);
    setIsSubmitting(false);
    submissionInProgress.current = false;
  }, [assignmentId, questionId]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Simplified test state change handler
  const handleTestStateChange = useCallback((passed: boolean) => {
    setTestResults({ 
      success: passed, 
      timestamp: Date.now()
    });
  }, []);

  // Memoized test result evaluation
  const allTestsPassed = useMemo(() => {
    return testResults?.success === true;
  }, [testResults]);

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
            <span>Test Results</span>
          </div>
          <div style={{ flex: 1 }}>
            <TestResultsDisplay 
              onTestStateChange={handleTestStateChange}
              questionId={questionId}
            />
          </div>
        </div>
      </SandpackLayout>
      
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          {testResults ? (
            <span style={{ color: allTestsPassed ? '#28a745' : '#dc3545' }}>
              {allTestsPassed ? '✅ All tests passed!' : '❌ Some tests failed'}
            </span>
          ) : (
            <span>Use the built-in run button to test your solution</span>
          )}
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
      baseFiles['/angular.json'] = {
        code: JSON.stringify({
          "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
          "version": 1,
          "newProjectRoot": "projects",
          "projects": {
            "demo": {
              "projectType": "application",
              "schematics": {},
              "root": "",
              "sourceRoot": "src",
              "prefix": "app",
              "architect": {
                "build": {
                  "builder": "@angular-devkit/build-angular:browser",
                  "options": {
                    "outputPath": "dist/demo",
                    "index": "src/index.html",
                    "main": "src/main.ts",
                    "polyfills": "src/polyfills.ts",
                    "tsConfig": "tsconfig.app.json",
                    "assets": [
                      "src/favicon.ico",
                      "src/assets"
                    ],
                    "styles": [
                      "src/styles.css"
                    ],
                    "scripts": []
                  }
                },
                "serve": {
                  "builder": "@angular-devkit/build-angular:dev-server",
                  "options": {}
                },
                "test": {
                  "builder": "@angular-devkit/build-angular:karma",
                  "options": {
                    "main": "src/test.ts",
                    "polyfills": "src/polyfills.ts",
                    "tsConfig": "tsconfig.spec.json",
                    "karmaConfig": "karma.conf.js",
                    "assets": [
                      "src/favicon.ico",
                      "src/assets"
                    ],
                    "styles": [
                      "src/styles.css"
                    ],
                    "scripts": []
                  }
                }
              }
            }
          },
          "defaultProject": "demo"
        }, null, 2),
        hidden: true
      };

      baseFiles['/tsconfig.json'] = {
        code: JSON.stringify({
          "compileOnSave": false,
          "compilerOptions": {
            "baseUrl": "./",
            "outDir": "./dist/out-tsc",
            "forceConsistentCasingInFileNames": true,
            "strict": false,
            "noImplicitOverride": true,
            "noPropertyAccessFromIndexSignature": false,
            "noImplicitReturns": true,
            "noFallthroughCasesInSwitch": true,
            "sourceMap": true,
            "declaration": false,
            "downlevelIteration": true,
            "experimentalDecorators": true,
            "moduleResolution": "node",
            "importHelpers": true,
            "target": "ES2022",
            "module": "ES2022",
            "useDefineForClassFields": false,
            "lib": [
              "ES2022",
              "dom"
            ]
          },
          "angularCompilerOptions": {
            "enableI18nLegacyMessageIdFormat": false,
            "strictInjectionParameters": true,
            "strictInputAccessModifiers": true,
            "strictTemplates": true
          }
        }, null, 2),
        hidden: true
      };

      baseFiles['/tsconfig.app.json'] = {
        code: JSON.stringify({
          "extends": "./tsconfig.json",
          "compilerOptions": {
            "outDir": "./out-tsc/app",
            "types": []
          },
          "files": [
            "src/main.ts",
            "src/polyfills.ts"
          ],
          "include": [
            "src/**/*.d.ts"
          ]
        }, null, 2),
        hidden: true
      };

      baseFiles['/tsconfig.spec.json'] = {
        code: JSON.stringify({
          "extends": "./tsconfig.json",
          "compilerOptions": {
            "outDir": "./out-tsc/spec",
            "types": [
              "jasmine"
            ]
          },
          "files": [
            "src/test.ts",
            "src/polyfills.ts"
          ],
          "include": [
            "src/**/*.spec.ts",
            "src/**/*.d.ts"
          ]
        }, null, 2),
        hidden: true
      };

      baseFiles['/src/polyfills.ts'] = {
        code: `/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into 2 sections:
 *   1. Browser polyfills. These are applied before loading ZoneJS and are sorted by browsers.
 *   2. Application imports. Files imported after ZoneJS that should be loaded before your main
 *      file.
 *
 * The current setup is for so-called "evergreen" browsers; the last versions of browsers that
 * automatically update themselves. This includes recent versions of Safari, Chrome (including
 * Opera), Edge on the desktop, and iOS and Chrome on mobile.
 *
 * Learn more in https://angular.io/guide/browser-support
 */

/***************************************************************************************************
 * BROWSER POLYFILLS
 */

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js';  // Included with Angular CLI.


/***************************************************************************************************
 * APPLICATION IMPORTS
 */`,
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
        code: `// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

declare const require: {
  context(path: string, deep?: boolean, filter?: RegExp): {
    keys(): string[];
    <T>(id: string): T;
  };
};

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Then we find all the tests.
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
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
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>`,
        hidden: true
      };

      baseFiles['/src/styles.css'] = {
        code: `/* You can add global styles to this file, and also import other style files */`,
        hidden: true
      };

      baseFiles['/karma.conf.js'] = {
        code: `// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-headless'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution order
        // random: false
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/demo'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
    restartOnFileChange: true
  });
};`,
        hidden: true
      };
      break;

    case 'javascript':
      baseFiles['/src/setupTests.js'] = {
        code: `import '@testing-library/jest-dom';
import 'whatwg-fetch';`,
        hidden: true
      };

      baseFiles['/package.json'] = {
        code: JSON.stringify({
          name: 'javascript-test',
          version: '1.0.0',
          dependencies: {
            '@testing-library/jest-dom': '^5.16.5',
            'whatwg-fetch': '^3.6.2',
          },
          devDependencies: {
            '@types/jest': '^29.5.5',
            'jest': '^29.5.0',
            'jest-environment-jsdom': '^29.5.0',
          },
          scripts: {
            test: 'jest --watchAll=false'
          },
          jest: {
            testEnvironment: 'jsdom',
            setupFilesAfterEnv: ['<rootDir>/src/setupTests.js']
          }
        }, null, 2),
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
        test: framework === 'angular' ? 'ng test --watch=false --browsers=ChromeHeadless' : framework === 'vue' ? 'vitest --run' : 'jest --watchAll=false'
      },
    };

    // Add Angular CLI configuration if needed
    if (framework === 'angular') {
      basePackage.devDependencies = {
        ...basePackage.devDependencies,
        '@angular-devkit/build-angular': '^16.0.0',
        '@angular/cli': '^16.0.0',
        'karma': '^6.4.0',
        'karma-chrome-launcher': '^3.2.0',
        'karma-coverage': '^2.2.0',
        'karma-jasmine': '^5.1.0',
        'karma-jasmine-html-reporter': '^2.1.0'
      };
    }

    return JSON.stringify(basePackage, null, 2);
  }, [framework, setup]);

  const files = useMemo(() => {
    const frameworkFiles = createFrameworkFiles(framework, starterCode, testCode);
    
    return {
      [mainFile]: { 
        code: starterCode, 
        active: true 
      },
      [testFile]: { 
        code: testCode, 
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

  return (
    <SandpackProvider 
      key={sandpackKey}
      customSetup={setup} 
      files={files} 
      options={{ 
        autorun: false,  // Prevent auto-running
        autoReload: false, // Prevent auto-reloading
        initMode: 'user-visible', // Ensures proper initialization for all frameworks
        bundlerURL: 'https://2-19-8-sandpack.codesandbox.io',
        logLevel: 'error', // Reduce console noise
        recompileMode: 'delayed',
        recompileDelay: 500
      }}
    >
      <SandpackLayoutManager assignmentId={assignmentId} questionId={questionId} {...rest} />
    </SandpackProvider>
  );
});

SandpackTest.displayName = 'SandpackTest';

export default SandpackTest;

