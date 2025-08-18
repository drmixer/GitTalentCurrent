import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
  SandpackConsole,
  useSandpack,
  type SandpackFiles,
  type SandpackProviderProps,
} from '@codesandbox/sandpack-react';
import { supabase } from '../../lib/supabase';

type Framework = 'react' | 'vue' | 'javascript';

interface SandpackTestProps {
  starterCode: string;
  testCode: string | null | undefined;
  framework: Framework;
  assignmentId: string;
  questionId: string;
  isLastQuestion: boolean;
  onNext: () => void;
  onComplete: () => void;
}

const getSetup = (framework: Framework) => {
  switch (framework) {
    case 'react':
      return {
        template: 'react-ts' as SandpackProviderProps['template'],
        codeFile: '/src/App.tsx',
        testFile: '/src/App.test.tsx',
        deps: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@testing-library/react': '^14.2.1',
          '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2',
          vitest: '^0.34.6',
        },
      };
    case 'vue':
      return {
        template: 'vanilla-ts' as SandpackProviderProps['template'],
        codeFile: '/src/App.vue',
        testFile: '/src/App.test.ts',
        deps: {
          vue: '^3.4.0',
          '@vue/compiler-sfc': '^3.4.0',
          '@vue/test-utils': '^2.4.6',
          '@testing-library/vue': '^8.0.2',
          '@testing-library/jest-dom': '^6.4.2',
          '@testing-library/user-event': '^14.5.2',
          vitest: '^1.6.0',
          jsdom: '^24.1.0',
          vite: '^5.2.0',
          '@vitejs/plugin-vue': '^5.0.0',
          '@vue/runtime-core': '^3.4.0',
          '@vue/runtime-dom': '^3.4.0',
          '@vue/reactivity': '^3.4.0',
          '@vue/shared': '^3.4.0',
        },
      };
    case 'javascript':
    default:
      return {
        template: 'vanilla-ts' as SandpackProviderProps['template'],
        codeFile: '/src/index.ts',
        testFile: '/src/index.test.ts',
        deps: {
          '@testing-library/dom': '^9.3.4',
          '@testing-library/user-event': '^14.5.2',
          '@testing-library/jest-dom': '^6.4.2',
          vitest: '^0.34.6',
        },
      };
  }
};

function parseSummary(text: string) {
  const ran = /Test suites?:|Test files?:|Tests?:|No tests found/i.test(text);
  if (!ran) return { ran: false, suites: undefined, tests: undefined };

  const suitesLine =
    text.match(/Test suites?:([^\n]+)/i)?.[1] ??
    text.match(/Test files?:([^\n]+)/i)?.[1] ??
    '';
  const testsLine = text.match(/Tests?:([^\n]+)/i)?.[1] ?? '';

  const num = (re: RegExp, s: string) => {
    const m = s.match(re);
    return m ? Number(m[1]) : undefined;
  };

  const suites = suitesLine
    ? { passed: num(/(\d+)\s*passed/i, suitesLine), failed: num(/(\d+)\s*failed/i, suitesLine), total: num(/(\d+)\s*total/i, suitesLine) }
    : undefined;

  const tests = testsLine
    ? { passed: num(/(\d+)\s*passed/i, testsLine), failed: num(/(\d+)\s*failed/i, testsLine), total: num(/(\d+)\s*total/i, testsLine) }
    : undefined;

  return { ran, suites, tests };
}

const TestsAndConsole: React.FC<{
  testsRootRef: React.RefObject<HTMLDivElement>;
  onTestsComplete: (rawText: string, parsed: any) => void;
  rerunKey: number;
}> = ({ testsRootRef, onTestsComplete, rerunKey }) => {
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const root = testsRootRef.current;
    if (!root) return;
    observerRef.current?.disconnect();

    const obs = new MutationObserver(() => {
      const text = root.textContent || '';
      if (!text) return;
      const parsed = parseSummary(text);
      if (parsed.ran) {
        onTestsComplete(text, parsed);
        obs.disconnect();
        observerRef.current = null;
      }
    });

    obs.observe(root, { childList: true, subtree: true, characterData: true });
    observerRef.current = obs;

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [onTestsComplete, rerunKey]);

  return (
    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb' }}>
      <div ref={testsRootRef} style={{ flex: 1, minHeight: 0 }}>
        <SandpackTests
          key={rerunKey}
          style={{ height: '100%' }}
          watchMode={false}
          showWatchButton={false}
          showVerboseButton={false}
        />
      </div>
      <div style={{ height: 180, borderTop: '1px solid #e5e7eb' }}>
        <SandpackConsole
          maxMessageCount={200}
          showHeader
          standalone
          style={{
            height: '100%',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
          }}
        />
      </div>
    </div>
  );
};

const SandpackTestInner: React.FC<
  SandpackTestProps & {
    template: SandpackProviderProps['template'];
    codeFile: string;
    testFile: string;
    deps: Record<string, string>;
  }
> = (props) => {
  const { assignmentId, questionId, isLastQuestion, onNext, onComplete } = props;

  const [canSubmit, setCanSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRawText, setLastRawText] = useState('');
  const [lastParsed, setLastParsed] = useState<{ ran: boolean; suites?: any; tests?: any } | null>(null);
  const [rerunKey, setRerunKey] = useState(0);

  const { sandpack } = useSandpack();
  const testsRootRef = useRef<HTMLDivElement>(null);

  const handleTestsComplete = (rawText: string, parsed: any) => {
    setLastRawText(rawText);
    setLastParsed(parsed);
    setCanSubmit(true);
    setIsRunning(false);
  };

  const handleRunTests = async () => {
    if (isRunning) return; // Prevent multiple clicks
    
    setIsRunning(true);
    setCanSubmit(false);
    setLastRawText('');
    setLastParsed(null);

    try {
      // Use runSandpack instead of restartSandpack
      await sandpack.runSandpack();
      
      // Wait a moment for compilation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Trigger test rerun by updating a file
      sandpack.updateFile('/__trigger__.ts', `// Test trigger ${Date.now()}\nexport default ${Date.now()};`);
      setRerunKey((k) => k + 1);

      // Extended timeout for Vue compilation
      setTimeout(() => {
        if (!canSubmit) {
          console.log('Test timeout - stopping running state');
          setIsRunning(false);
        }
      }, 35000);
    } catch (error) {
      console.error('[SandpackTest] Error running tests:', error);
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!lastParsed) return;

    const tests = lastParsed.tests || {};
    const total = typeof tests.total === 'number' ? tests.total : undefined;
    const failed = typeof tests.failed === 'number' ? tests.failed : undefined;
    const passed = typeof tests.passed === 'number' ? tests.passed : undefined;

    let score = 0;
    if (total && total > 0) {
      if (typeof failed === 'number') score = failed === 0 ? 1 : 0;
      else if (typeof passed === 'number') score = passed === total ? 1 : 0;
      else score = 1;
    }

    const { error: upsertError } = await supabase
      .from('test_results')
      .upsert(
        {
          assignment_id: assignmentId,
          question_id: questionId,
          score,
          passed_test_cases: passed ?? null,
          total_test_cases: total ?? null,
          stdout: lastRawText,
          stderr: '',
        },
        { onConflict: 'assignment_id,question_id' }
      );

    if (upsertError) {
      console.error('[SandpackTest] submit upsert error', upsertError);
      alert('Failed to submit results. Please try again.');
      return;
    }

    setSubmitted(true);
    setTimeout(() => {
      if (isLastQuestion) onComplete();
      else onNext();
    }, 2000);
  };

  return (
    <>
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        {submitted ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#10b981', fontWeight: '600' }}>
            ✅ Submitted! Advancing to next question...
          </p>
        ) : canSubmit ? (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: '#059669', fontWeight: '500' }}>✅ Tests completed!</p>
            <button
              onClick={handleSubmit}
              style={{
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              }}
            >
              Submit Results
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
              Write your code, then run tests to see results
            </p>
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              style={{
                padding: '10px 20px',
                backgroundColor: isRunning ? '#94a3b8' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isRunning ? (
                <>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff40',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  Running Tests...
                </>
              ) : (
                '▶️ Run Tests'
              )}
            </button>
          </>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      <div className="gt-sp">
        <SandpackLayout>
          <SandpackCodeEditor style={{ height: '70vh' }} showTabs showLineNumbers showInlineErrors />
          <TestsAndConsole testsRootRef={testsRootRef} onTestsComplete={handleTestsComplete} rerunKey={rerunKey} />
        </SandpackLayout>
      </div>
    </>
  );
};

const SandpackTest: React.FC<SandpackTestProps> = (props) => {
  const { template, codeFile, testFile, deps } = getSetup(props.framework);

  const files = useMemo<SandpackFiles>(() => {
    if (!props.testCode) return {};

    const baseFiles: SandpackFiles = {
      [codeFile]: { code: props.starterCode ?? '', active: true },
      [testFile]: { code: props.testCode ?? '', hidden: false },
      '/__trigger__.ts': { code: `export default 0;`, hidden: true },
    };

    if (props.framework === 'vue') {
      // Vite configuration with proper Vue SFC support
      baseFiles['/vite.config.ts'] = {
        code: `
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith('custom-')
      }
    }
  })],
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    'process.env.NODE_ENV': '"test"',
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  esbuild: {
    target: 'esnext',
    format: 'esm'
  },
  optimizeDeps: {
    include: ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/reactivity']
  }
});
        `.trim(),
        hidden: true,
      };

      // Vitest configuration
      baseFiles['/vitest.config.ts'] = {
        code: `
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith('custom-')
      }
    }
  })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.js'],
    reporter: 'verbose',
    deps: {
      inline: ['@vue', '@testing-library/vue']
    }
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    'process.env.NODE_ENV': '"test"',
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  esbuild: {
    target: 'esnext',
    format: 'esm'
  }
});
        `.trim(),
        hidden: true,
      };

      // Enhanced setup file with proper Vue globals
      baseFiles['/src/setupTests.ts'] = {
        code: `
import '@testing-library/jest-dom';
import { config } from '@vue/test-utils';
import * as Vue from 'vue';
import { createApp } from 'vue';

// Make Vue globally available
(globalThis as any).Vue = Vue;
(globalThis as any).createApp = createApp;
(window as any).Vue = Vue;
(window as any).createApp = createApp;

// Configure Vue Test Utils globally
config.global.config.globalProperties = {
  ...config.global.config.globalProperties
};

config.global.config.compilerOptions = {
  isCustomElement: (tag: string) => tag.startsWith('custom-')
};

// Export for direct imports
export { Vue, createApp };
export default Vue;
        `.trim(),
        hidden: true,
      };

      // Main entry point
      baseFiles['/src/main.ts'] = {
        code: `
import { createApp } from 'vue';
import App from './App.vue';

// Create and mount the app
const app = createApp(App);
app.mount('#app');

export { app };
        `.trim(),
        hidden: true,
      };

      // Enhanced package.json with proper module configuration
      baseFiles['/package.json'] = {
        code: JSON.stringify({
          "name": "vue-test-environment",
          "version": "1.0.0",
          "type": "module",
          "scripts": {
            "dev": "vite",
            "build": "vite build",
            "test": "vitest run --reporter=verbose --no-coverage",
            "test:watch": "vitest --reporter=verbose"
          },
          "dependencies": deps,
          "main": "./src/main.ts"
        }, null, 2),
        hidden: true,
      };

      // HTML template
      baseFiles['/index.html'] = {
        code: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue Test App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
        `.trim(),
        hidden: true,
      };

      // TypeScript configuration
      baseFiles['/tsconfig.json'] = {
        code: JSON.stringify({
          "compilerOptions": {
            "target": "ESNext",
            "useDefineForClassFields": true,
            "lib": ["DOM", "DOM.Iterable", "ESNext"],
            "allowJs": false,
            "skipLibCheck": true,
            "esModuleInterop": false,
            "allowSyntheticDefaultImports": true,
            "strict": true,
            "forceConsistentCasingInFileNames": true,
            "module": "ESNext",
            "moduleResolution": "bundler",
            "resolveJsonModule": true,
            "isolatedModules": true,
            "noEmit": true,
            "jsx": "preserve",
            "types": ["vitest/globals", "@testing-library/jest-dom"],
            "baseUrl": ".",
            "paths": {
              "@/*": ["./src/*"]
            }
          },
          "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
          "references": [{ "path": "./tsconfig.node.json" }]
        }, null, 2),
        hidden: true,
      };

      // Node TypeScript configuration
      baseFiles['/tsconfig.node.json'] = {
        code: JSON.stringify({
          "compilerOptions": {
            "composite": true,
            "skipLibCheck": true,
            "module": "ESNext",
            "moduleResolution": "bundler",
            "allowSyntheticDefaultImports": true,
            "strict": true,
            "types": ["node"]
          },
          "include": ["vite.config.ts", "vitest.config.ts"]
        }, null, 2),
        hidden: true,
      };
    }

    return baseFiles;
  }, [props.starterCode, props.testCode, codeFile, testFile, props.framework, deps]);

  if (!props.testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  return (
    <SandpackProvider
      key={`${template}-${codeFile}-${testFile}-${props.questionId}`}
      template={template}
      customSetup={{ dependencies: deps }}
      files={files}
      options={{
        autorun: false,
        initMode: 'lazy',
        showTabs: true,
        showNavigator: false,
        showInlineErrors: true,
        showErrorOverlay: true,
        visibleFiles: [codeFile, testFile],
        activeFile: codeFile,
        bundlerURL: 'https://sandpack-bundler.codesandbox.io/',
        logLevel: props.framework === 'vue' ? 'verbose' : 'info',
      }}
    >
      <SandpackTestInner
        {...props}
        template={template}
        codeFile={codeFile}
        testFile={testFile}
        deps={deps}
      />
    </SandpackProvider>
  );
};

export default SandpackTest;
