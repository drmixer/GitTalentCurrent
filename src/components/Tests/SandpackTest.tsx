import React, { useState, useEffect, useMemo } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackTests,
  useSandpack,
  SandpackFileExplorer,
} from '@codesandbox/sandpack-react';
import type { SandpackSetup, SandpackFiles } from '@codesandbox/sandpack-react';
import { supabase } from '../../lib/supabase';

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
            '@angular/animations': '^17.0.0',
            '@angular/common': '^17.0.0',
            '@angular/compiler': '^17.0.0',
            '@angular/core': '^17.0.0',
            '@angular/forms': '^17.0.0',
            '@angular/platform-browser': '^17.0.0',
            '@angular/platform-browser-dynamic': '^17.0.0',
            '@angular/router': '^17.0.0',
            'rxjs': '^7.8.0',
            'zone.js': '^0.14.0',
            'tslib': '^2.6.0',
          },
          devDependencies: {
            '@angular/compiler-cli': '^17.0.0',
            '@angular/core/testing': '^17.0.0',
            '@angular/common/testing': '^17.0.0',
            '@angular/platform-browser/testing': '^17.0.0',
            '@testing-library/angular': '^14.2.0',
            'jasmine-core': '^5.1.1',
            'karma': '^6.4.2',
            'karma-jasmine': '^5.1.0',
            'karma-chrome-launcher': '^3.2.0',
            'typescript': '^5.1.6',
          },
          template: 'angular',
          entry: '/src/main.ts',
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

// A custom test header with a "Run Tests" button
const CustomTestHeader: React.FC<{ onRunTests: () => void }> = ({ onRunTests }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px' }}>
        <h4>Tests</h4>
        <button onClick={onRunTests} style={{ padding: '4px 8px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
            Run Tests
        </button>
    </div>
);

// Child component that contains the UI and logic which depends on the Sandpack context
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const { sandpack } = useSandpack();
  const [testResults, setTestResults] = useState<SandpackTestsProps | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runTests = () => {
    sandpack.runTests();
  };

  // This function only stores results in state - NO database save
  const handleTestComplete = (payload: SandpackTestsProps) => {
    setTestResults(payload);
    // Removed database save - only store in component state for UI feedback
  };

  // Only this function saves to database - prevents duplicates
  const submitSolution = async () => {
    if (!allTestsPassed) {
      alert('Please ensure all tests are passing before you submit.');
      return;
    }

    setIsSubmitting(true);
    try {
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

      // Use upsert to prevent duplicates in case of multiple submissions
      const { error } = await supabase.from('test_results').upsert({
        assignment_id: assignmentId,
        question_id: questionId,  
        score: 1, // This is based on allTestsPassed, so it's already correct
        passed_test_cases: passed_test_cases,
        total_test_cases: total_test_cases,
        stdout: JSON.stringify(testResults, null, 2), // For logging/debugging
        stderr: '', // For schema compatibility
      }, {
        onConflict: 'assignment_id,question_id'
      });
      
      if (error) throw error;
      console.log('Solution submitted successfully!');
      onTestComplete();
    } catch (error) {
      console.error('Failed to submit solution:', error);
      alert('There was an error submitting your solution. Please try again.');
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
      <SandpackLayout>
        <SandpackCodeEditor style={{ height: '60vh' }} />
        <SandpackTests
          style={{ height: '60vh' }}
          headerChildren={<CustomTestHeader onRunTests={runTests} />}
          onComplete={handleTestComplete}
        />
      </SandpackLayout>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={submitSolution}
          disabled={!allTestsPassed || isSubmitting}
          style={{
            padding: '10px 20px',
            background: !allTestsPassed || isSubmitting ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !allTestsPassed || isSubmitting ? 'not-allowed' : 'pointer',
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
      // Angular polyfills
      baseFiles['/src/polyfills.ts'] = {
        code: `/***************************************************************************************************
 * APPLICATION POLYFILLS
 * These are needed for Angular to run properly in a browser-like environment.
 */

// Zone JS is required by Angular
import 'zone.js'  // Included with Angular CLI

// Add more polyfills here if needed`,
        hidden: true
      };

      // Angular main bootstrap
      baseFiles['/src/main.ts'] = {
        code: `import 'zone.js'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'
import { AppModule } from './app/app.module'

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err))`,
        hidden: true
      };

      // Angular app module - this will need to be dynamic based on the component being tested
      baseFiles['/src/app/app.module.ts'] = {
        code: `import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { AppComponent } from './app.component'

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}`,
        hidden: true
      };

      // Angular test setup
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
      
      baseFiles['/angular.json'] = {
        code: JSON.stringify({
          "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
          "version": 1,
          "newProjectRoot": "projects",
          "projects": {
            "app": {
              "projectType": "application",
              "schematics": {},
              "root": "",
              "sourceRoot": "src",
              "prefix": "app",
              "architect": {
                "build": {
                  "builder": "@angular-devkit/build-angular:browser",
                  "options": {
                    "outputPath": "dist",
                    "index": "src/index.html",
                    "main": "src/main.ts",
                    "polyfills": "src/polyfills.ts",
                    "tsConfig": "tsconfig.app.json"
                  }
                },
                "test": {
                  "builder": "@angular-devkit/build-angular:karma",
                  "options": {
                    "main": "src/test.ts",
                    "polyfills": "src/polyfills.ts",
                    "tsConfig": "tsconfig.spec.json",
                    "karmaConfig": "karma.conf.js"
                  }
                }
              }
            }
          }
        }, null, 2),
        hidden: true
      };

      baseFiles['/src/index.html'] = {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Angular Sandbox</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>`,
        hidden: true
      };

      // TypeScript configurations
      baseFiles['/tsconfig.json'] = {
        code: JSON.stringify({
          "compileOnSave": false,
          "compilerOptions": {
            "baseUrl": "./",
            "outDir": "./dist/out-tsc",
            "forceConsistentCasingInFileNames": true,
            "strict": true,
            "noImplicitOverride": true,
            "noPropertyAccessFromIndexSignature": true,
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
    dependencies: setup.dependencies,
    devDependencies: setup.devDependencies || {},
    scripts: { 
      test: framework === 'vue' ? 'vitest' : framework === 'angular' ? 'ng test' : 'react-scripts test',
      build: framework === 'vue' ? 'vite build' : framework === 'angular' ? 'ng build' : 'react-scripts build'
    },
  });

  // Create framework-specific setup files
  const frameworkFiles = createFrameworkFiles(framework, starterCode, testCode);

  const files = {
    [mainFile]: { code: starterCode, active: true },
    [testFile]: { code: testCode, hidden: true },
    '/package.json': { code: packageJson, hidden: true },
    ...frameworkFiles,
  };

  return (
    <SandpackProvider customSetup={setup} files={files} options={{ autorun: false }}>
      <SandpackLayoutManager {...rest} />
    </SandpackProvider>
  );
};

export default SandpackTest;
