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
  testCode: string;
  framework: SupportedFramework;
  testId: number;
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
const SupabaseTestReporter: React.FC<{ testId: number }> = ({ testId }) => {
  const { sandpack } = useSandpack();

  useEffect(() => {
    const stopListening = sandpack.listen(async (message) => {
      if (message.type === 'test:end') {
        const testResults = message.payload;
        try {
          const { data, error } = await supabase
            .from('coding_tests')
            .update({
              results: testResults,
              status: testResults.tests.every(t => t.status === 'pass') ? 'passed' : 'failed',
            })
            .eq('id', testId);

          if (error) console.error('Error saving test results:', error);
          else console.log('Test results saved successfully.');
        } catch (error) {
          console.error('An unexpected error occurred:', error);
        }
      }
    });

    return () => stopListening();
  }, [sandpack, testId]);

  return null;
};

const SandpackTest: React.FC<SandpackTestProps> = ({
  starterCode,
  testCode,
  framework,
  testId,
}) => {
  const { setup, mainFile, testFile } = getFrameworkConfig(framework);

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
    // Add the package.json to the files object
    '/package.json': {
      code: packageJson,
      hidden: true,
    }
  };

  return (
    <SandpackProvider
      template={framework.toLowerCase() as SupportedFramework}
      // customSetup is no longer needed as we provide an explicit package.json
      // customSetup={setup}
      files={files}
      options={{
        showTabs: true,
        showLineNumbers: true,
        showInlineErrors: true,
        autorun: true,
        // Re-evaluate the autorun delay if needed
        // autorun, autorunDelay: 300
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
      <SupabaseTestReporter testId={testId} />
    </SandpackProvider>
  );
};

export default SandpackTest;
