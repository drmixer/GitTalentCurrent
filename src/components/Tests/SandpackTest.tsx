import React, { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
} from '@codesandbox/sandpack-react';
import type { SandpackFiles, SandpackProviderProps } from '@codesandbox/sandpack-react';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | null | undefined;
  framework: 'react';
  assignmentId: string;
  questionId: string;
  onTestComplete: () => void;
}

const SandpackTest: React.FC<SandpackTestProps> = ({ starterCode, testCode }) => {
  const files = useMemo<SandpackFiles>(() => {
    return {
      '/src/App.tsx': { code: starterCode ?? '', active: true },
      '/src/App.test.tsx': { code: testCode ?? '', hidden: false },
    };
  }, [starterCode, testCode]);

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      template={'react-ts' as SandpackProviderProps['template']}
      customSetup={{
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1',
          '@testing-library/jest-dom': '^6.5.0',
          '@testing-library/user-event': '^14.5.2',
          vitest: '^0.34.6',
        },
      }}
      files={files}
      options={{
        autorun: true,
        initMode: 'immediate',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        showConsole: false,
        visibleFiles: ['/src/App.tsx', '/src/App.test.tsx'],
        activeFile: '/src/App.tsx',
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
            {/* Single, built-in Run button lives here */}
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
