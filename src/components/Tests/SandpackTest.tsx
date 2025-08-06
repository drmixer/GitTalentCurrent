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
      // === AUTH DEBUG SECTION ===
      console.log('=== AUTHENTICATION DEBUG ===');
      
      // Check current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Current user:', user);
      console.log('User ID:', user?.id);
      console.log('Auth error:', authError);
      console.log('Expected user ID:', 'd6771413-36fb-4907-abf7-f304b255fc34');
      console.log('IDs match:', user?.id === 'd6771413-36fb-4907-abf7-f304b255fc34');
      
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', sessionData.session);
      console.log('Session error:', sessionError);
      console.log('Access token exists:', !!sessionData.session?.access_token);
      
      if (sessionData.session?.expires_at) {
        const expiresAt = new Date(sessionData.session.expires_at * 1000);
        console.log('Token expires at:', expiresAt);
        console.log('Token expired?', expiresAt < new Date());
      }

      // Test auth with a simple query
      console.log('Testing auth with a simple query...');
      const { data: authTest, error: authTestError } = await supabase
        .from('users')
        .select('id, role')
        .limit(1);
      console.log('Auth test result:', { data: authTest, error: authTestError });

      // If no user, stop here
      if (!user) {
        alert('Authentication required! Please log in and try again.');
        return;
      }

      // === END AUTH DEBUG SECTION ===

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

      console.log('Submitting data:', {
        assignment_id: assignmentId,
        question_id: questionId,  
        score: 1,
        passed_test_cases: passed_test_cases,
        total_test_cases: total_test_cases,
        user_id: user.id, // Add this for debugging
      });

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
      
      if (error) {
        console.error('Database error details:', error);
        throw error;
      }
      
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

      // Remove unnecessary files that might cause conflicts
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
