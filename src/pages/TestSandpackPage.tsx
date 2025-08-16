import React from 'react';
import SandpackTest from '../components/Tests/SandpackTest';

const TestSandpackPage: React.FC = () => {
  const sampleReactCode = `import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Counter App</h1>
      <div>
        <p>Current Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>
          Increment
        </button>
        <button onClick={() => setCount(count - 1)} disabled={count <= 0}>
          Decrement
        </button>
        <button onClick={() => setCount(0)}>
          Reset
        </button>
      </div>
    </div>
  );
}

export default Counter;`;

  const sampleTestCode = `import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Counter from './App';

test('counter increments correctly', () => {
  render(<Counter />);
  const incrementButton = screen.getByText('Increment');
  fireEvent.click(incrementButton);
  expect(screen.getByText('1')).toBeInTheDocument();
});

test('counter decrements and disables at zero', () => {
  render(<Counter />);
  const decrementButton = screen.getByText('Decrement');
  expect(decrementButton).toBeDisabled();
  expect(screen.getByText('0')).toBeInTheDocument();
});

test('reset button works correctly', () => {
  render(<Counter />);
  const incrementButton = screen.getByText('Increment');
  const resetButton = screen.getByText('Reset');
  
  // Increment a few times
  fireEvent.click(incrementButton);
  fireEvent.click(incrementButton);
  
  // Reset
  fireEvent.click(resetButton);
  expect(screen.getByText('0')).toBeInTheDocument();
});`;

  const handleTestComplete = () => {
    console.log('Test completed and submitted!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Sandpack Testing Environment
        </h1>
        <p className="text-gray-600 mb-4">
          This page demonstrates the improved Sandpack testing functionality with manual test running and enhanced console output.
        </p>
        
        {/* Framework Navigation */}
        <div className="flex space-x-4 mb-8">
          <a 
            href="/test-sandpack" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            React Test
          </a>
          <a 
            href="/test-javascript" 
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
          >
            JavaScript Test
          </a>
          <a 
            href="/test-vue" 
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Vue.js Test
          </a>
          <a 
            href="#" 
            className="px-4 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
            title="Angular support coming soon"
          >
            Angular Test (Coming Soon)
          </a>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">React Counter Component Test</h2>
          <p className="text-gray-600 mb-6">
            Complete the counter component and make sure all tests pass. Click "Run Tests" to execute the test suite.
          </p>
          
          <SandpackTest
            framework="react"
            starterCode={sampleReactCode}
            testCode={sampleTestCode}
            assignmentId="test-assignment-123"
            questionId="test-question-456"
            onTestComplete={handleTestComplete}
          />
        </div>
      </div>
    </div>
  );
};

export default TestSandpackPage;