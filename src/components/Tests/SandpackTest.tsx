import React, { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
} from '@codesandbox/sandpack-react';
import type {
  SandpackFiles,
  SandpackProviderProps,
  SandpackSetup,
} from '@codesandbox/sandpack-react';

type SupportedFramework = 'react';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | undefined | null;
  framework: SupportedFramework;
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
}

const getFrameworkConfig = (): { setup: SandpackSetup; mainFile: string; testFile: string } => ({
  setup: {
    template: 'react-ts',
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      '@testing-library/react': '^14.2.1',
      '@testing-library/jest-dom': '^6.5.0',
      '@testing-library/user-event': '^14.5.2',
      vitest: '^0.34.6',
    },
  },
  mainFile: '/src/App.tsx',
  testFile: '/src/App.test.tsx',
});

const SandpackTest: React.FC<SandpackTestProps> = ({ starterCode, testCode }) => {
  const { setup, mainFile, testFile } = getFrameworkConfig();

  const files = useMemo(() => {
    const baseFiles: SandpackFiles = {
      [mainFile]: { code: starterCode, active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
      '/App.test.tsx': {
        code: `
/**
 * Bridge file to guarantee test discovery at project root.
 * Ensures jest-dom (vitest) matchers are registered before running /src tests.
 */
import './setupTests';
import './src/App.test.tsx';
`.trim(),
        hidden: false,
      },
      '/setupTests.ts': {
        code: `import '@testing-library/jest-dom/vitest';`,
        hidden: true,
      },
    };
    return baseFiles;
  }, [starterCode, testCode, mainFile, testFile]);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      template={setup.template as SandpackProviderProps['template']}
      customSetup={{ dependencies: setup.dependencies, devDependencies: setup.devDependencies || {} }}
      files={files}
      options={{
        autorun: true,
        initMode: 'immediate',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        showConsole: false,
        visibleFiles: [mainFile, testFile, '/App.test.tsx'],
        activeFile: mainFile,
      }}
    >
      <SandpackLayout>
        <div style={{ display: 'flex', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <SandpackCodeEditor
              style={{ height: '60vh' }}
              showTabs
              showLineNumbers
              showInlineErrors
            />
          </div>
          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
            <div style={{ height: 160, borderBottom: '1px solid #e5e7eb', overflow: 'auto' }}>
              <SandpackConsole maxMessageCount={200} />
            </div>
            <div style={{ flex: 1 }}>
              <SandpackTests
                showVerboseButton={false}
                showWatchButton={false}
                verbose={true}
                watchMode={false}
                style={{ height: '100%' }}
              />
            </div>
          </div>
        </div>
      </SandpackLayout>
    </SandpackProvider>
  );
};

export default SandpackTest;
