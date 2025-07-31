import React, { useEffect } from 'react';
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
            'vitest': '^0.34.6',
          },
        },
        mainFile: '/src/App.vue',
        testFile: '/src/App.spec.js',
      };
    case 'angular':
      return {
        setup: {
          dependencies: {
            '@angular/common': '^16.2.0',
            '@angular/compiler': '^16.2.0',
            '@angular/core': '^16.2.0',
            '@angular/platform-browser': '^16.2.0',
            'rxjs': '^7.8.0',
            'zone.js': '^0.13.0',
            'jasmine-core': '^5.1.1',
          },
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
          },
        },
        mainFile: '/App.js',
        testFile: '/App.test.js',
      };
  }
};


// A helper component to listen for test results and send them to Supabase
const SupabaseTestReporter: React.FC<{
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
}> = ({ assignmentId, questionId, onTestComplete }) => {
  const { sandpack } = useSandpack();

  useEffect(() => {
    console.log('[SupabaseTestReporter] sandpack object:', sandpack);
    // This effect should only run once to set up the listener
    const stopListening = sandpack.listen(async (message) => {
      if (message.type === 'test:end') {
        const testResults = message.payload;
        const allTestsPassed = testResults.tests.every((t) => t.status === 'pass');

        try {
          const { error } = await supabase.from('test_results').insert({
            assignment_id: assignmentId,
            question_id: questionId,
            score: allTestsPassed ? 1 : 0,
            // Storing the full Sandpack result object might be useful
            results: testResults,
            passed_test_cases: testResults.tests.filter(t => t.status === 'pass').length,
            total_test_cases: testResults.tests.length,
          });

          if (error) {
            console.error('Error saving test results:', error);
          } else {
            console.log('Sandpack test results saved successfully.');
            // Notify the parent component that the test is complete
            onTestComplete();
          }
        } catch (error) {
          console.error('An unexpected error occurred:', error);
        }
      }
    });

    return () => stopListening();
    // Use assignmentId and questionId as dependencies to re-bind if they change
  }, [sandpack, assignmentId, questionId, onTestComplete]);

  return null;
};

const SandpackTest: React.FC<SandpackTestProps> = ({
  starterCode,
  testCode,
  framework,
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const { setup, mainFile, testFile } = getFrameworkConfig(framework);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  // Explicitly create a package.json file for the sandbox
  const packageJson = JSON.stringify({
    name: `gittalent-${framework}-challenge`,
    version: '1.0.0',
    main: mainFile,
    dependencies: setup.dependencies,
    scripts: {
        "start": "react-scripts start",
        "build": "react-scripts build",
        "test": "react-scripts test",
        "eject": "react-scripts eject"
    }
  });

  const files: SandpackFiles = {
    [mainFile]: {
      code: starterCode,
      active: true,
    },
    [testFile]: {
      code: testCode,
      hidden: true,
    },
    '/package.json': {
      code: packageJson,
      hidden: true,
    }
  };

  return (
    <SandpackProvider
      template={framework.toLowerCase() as SupportedFramework}
      files={files}
      options={{
        showTabs: true,
        showLineNumbers: true,
        showInlineErrors: true,
        autorun: true,
      }}
    >
      <SandpackLayout>
        <SandpackFileExplorer style={{ height: '70vh' }} />
        <SandpackCodeEditor style={{ height: '70vh' }} />
        <SandpackPreview style={{ height: '70vh' }} />
      </SandpackLayout>
      <SandpackLayout style={{ marginTop: '1rem' }}>
        <SandpackTests style={{ height: '30vh' }} />
      </SandpackLayout>
      <SupabaseTestReporter
        assignmentId={assignmentId}
        questionId={questionId}
        onTestComplete={onTestComplete}
      />
    </SandpackProvider>
  );
};

export default SandpackTest;
