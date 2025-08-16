import React, { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
  useSandpack,
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

const TestToolbar: React.FC = () => {
  const { sandpack } = useSandpack();
  const isRunning = sandpack.status === 'running';

  const handleRun = () => {
    // Triggers a fresh compile/run; the Tests panel will pick it up.
    sandpack.runSandpack();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      borderBottom: '1px solid #e5e7eb',
      background: '#fafafa',
    }}>
      <div style={{ fontWeight: 600 }}>Tests</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #111827',
            background: isRunning ? '#9CA3AF' : '#111827',
            color: '#fff',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
          aria-label="Run tests"
          title={isRunning ? 'Running…' : 'Run tests'}
        >
          {isRunning ? 'Running…' : 'Run Tests'}
        </button>
      </div>
    </div>
  );
};

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
          '@testing-library/user-event': '^14.5.2',
          // We keep vitest available to the runner, but tests use plain assertions for stability
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
      {/* Scoped CSS that hides the built-in Run button inside the Tests panel only */}
      <style>{`
        /* Hide ALL buttons inside our Tests panel to ensure there's only one Run button (ours). */
        .custom-tests-panel button { display: none !important; }
      `}</style>

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

            {/* Custom header + button */}
            <TestToolbar />

            {/* Tests panel: results UI only (its internal Run button is hidden via CSS) */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <SandpackTests
                className="custom-tests-panel"
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
