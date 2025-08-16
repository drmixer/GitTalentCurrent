import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackTests,
} from '@codesandbox/sandpack-react';
import type { SandpackSetup, SandpackFiles, SandpackTestResult, SandpackProviderProps } from '@codesandbox/sandpack-react';
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

// FIXED: Use proper Sandpack templates instead of vanilla + dependencies
const getFrameworkConfig = (framework: SupportedFramework): { setup: SandpackSetup, mainFile: string, testFile: string } => {
  switch (framework) {
    case 'vue':
      return {
        setup: {
          template: 'vue3', // Use proper Vue3 template
          dependencies: {
            'vue': '^3.3.4',
          }
        },
        mainFile: '/src/App.vue',
        testFile: '/src/test.js',
      };

    case 'angular':
      return {
        setup: {
          template: 'angular', // Use proper Angular template
          dependencies: {
            '@angular/animations': '^16.0.0',
            '@angular/common': '^16.0.0',
            '@angular/compiler': '^16.0.0',
            '@angular/core': '^16.0.0',
            '@angular/forms': '^16.0.0',
            '@angular/platform-browser': '^16.0.0',
            '@angular/platform-browser-dynamic': '^16.0.0',
            'rxjs': '^7.8.0',
            'zone.js': '^0.13.0',
          }
        },
        mainFile: '/src/app/app.component.ts',
        testFile: '/src/test.ts',
      };

    case 'javascript':
      return {
        setup: {
          template: 'vanilla', // Use vanilla for plain JavaScript
          dependencies: {
            'vitest': '^0.34.0',
            '@testing-library/jest-dom': '^5.16.5',
          }
        },
        mainFile: '/src/index.js',
        testFile: '/src/index.test.js',
      };

    case 'react':
    default:
      return {
        setup: {
          template: 'react', // Use proper React template
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            '@testing-library/react': '^13.4.0',
            '@testing-library/jest-dom': '^5.16.5',
            '@testing-library/user-event': '^14.4.3',
          }
        },
        mainFile: '/App.js',
        testFile: '/App.test.js',
      };
  }
};

// Main layout component with enhanced status display
const SandpackLayoutManager: React.FC<Omit<SandpackTestProps, 'framework' | 'starterCode' | 'testCode'>> = ({
  assignmentId,
  questionId,
  onTestComplete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  const handleTestComplete = (results: SandpackTestResult) => {
    if (results && results.tests) {
        const allPassed = results.tests.every(result => result.status === 'pass');
        setAllTestsPassed(allPassed);
    }
  };

  const submitSolution = useCallback(async () => {
    if (!allTestsPassed) {
      showToast('Please ensure all tests are passing before you submit.', 'error');
      return;
    }

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
        }, { onConflict: 'assignment_id,question_id' });

      if (insertError) throw insertError;

      showToast('Solution submitted successfully! 🎉', 'success');
      onTestComplete();
      
    } catch (error) {
      if (error instanceof Error) {
        showToast(`Failed to submit solution: ${error.message}`, 'error');
      } else {
        showToast('Failed to submit solution. Please try again.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [allTestsPassed, assignmentId, questionId, onTestComplete, showToast]);

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      <SandpackLayout>
        <SandpackCodeEditor style={{ height: '60vh' }} />
        <SandpackTests style={{ height: '60vh' }} onComplete={handleTestComplete} />
      </SandpackLayout>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={submitSolution}
          disabled={!allTestsPassed || isSubmitting}
          style={{
            padding: '10px 20px',
            background: (!allTestsPassed || isSubmitting) ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!allTestsPassed || isSubmitting) ? 'not-allowed' : 'pointer',
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

// Main component with framework prop passed through
const SandpackTest: React.FC<SandpackTestProps> = React.memo(({
  starterCode,
  testCode,
  framework,
  assignmentId,
  questionId,
  ...rest
}) => {
  const { setup, mainFile, testFile } = getFrameworkConfig(framework);

  const files = useMemo(() => {
    const baseFiles: SandpackFiles = {
      [mainFile]: { code: starterCode, active: true },
      [testFile]: { code: testCode ?? '', hidden: false },
    };

    console.log('📁 Sandpack files created for', framework, ':', Object.keys(baseFiles));
    return baseFiles;
  }, [framework, starterCode, testCode, mainFile, testFile]);

  const sandpackKey = useMemo(() => 
    `${assignmentId}-${questionId}-${framework}`, 
    [assignmentId, questionId, framework]
  );

  if (!testCode) {
    return <div>This Sandpack question is missing its test code.</div>;
  }

  console.log('🚀 Initializing Sandpack with template:', setup.template, 'for framework:', framework);

  return (
    <SandpackProvider 
      key={sandpackKey}
      template={setup.template as SandpackProviderProps['template']}
      customSetup={{
        dependencies: setup.dependencies,
        devDependencies: setup.devDependencies || {}
      }}
      files={files} 
      options={{ 
        autorun: false,
        autoReload: false, 
        initMode: 'user-visible',
        bundlerURL: 'https://sandpack-bundler.codesandbox.io',
        logLevel: 'error',
        recompileMode: 'delayed',
        recompileDelay: 300,
        showTabs: true,
        showNavigator: true,
        showInlineErrors: false,
        showErrorOverlay: true
      }}
    >
      <SandpackLayoutManager 
        assignmentId={assignmentId} 
        questionId={questionId} 
        {...rest} 
      />
    </SandpackProvider>
  );
});

SandpackTest.displayName = 'SandpackTest';

export default SandpackTest;
