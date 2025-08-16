import React from 'react';
import SandpackTest from '../components/Tests/SandpackTest';

const TestJavaScriptPage: React.FC = () => {
  const sampleJavaScriptCode = `// Simple calculator functions
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

// Export for testing
module.exports = { add, subtract, multiply, divide };`;

  const sampleJavaScriptTestCode = `const { add, subtract, multiply, divide } = require('./index.js');

test('add function should add two numbers', () => {
  expect(add(2, 3)).toBe(5);
  expect(add(-1, 1)).toBe(0);
  expect(add(0, 0)).toBe(0);
});

test('subtract function should subtract two numbers', () => {
  expect(subtract(5, 3)).toBe(2);
  expect(subtract(1, 1)).toBe(0);
  expect(subtract(-1, -1)).toBe(0);
});

test('multiply function should multiply two numbers', () => {
  expect(multiply(3, 4)).toBe(12);
  expect(multiply(-2, 3)).toBe(-6);
  expect(multiply(0, 5)).toBe(0);
});

test('divide function should divide two numbers', () => {
  expect(divide(10, 2)).toBe(5);
  expect(divide(-8, 4)).toBe(-2);
  expect(() => divide(10, 0)).toThrow('Division by zero');
});`;

  const handleTestComplete = () => {
    console.log('JavaScript test completed and submitted!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          JavaScript Testing Environment
        </h1>
        <p className="text-gray-600 mb-4">
          Complete the calculator functions and make sure all tests pass. This demonstrates vanilla JavaScript testing with Vitest.
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
          <h2 className="text-xl font-semibold mb-4">JavaScript Calculator Functions Test</h2>
          <p className="text-gray-600 mb-6">
            Implement the calculator functions: add, subtract, multiply, and divide. Click "Run Tests" to execute the test suite.
          </p>
          
          <SandpackTest
            framework="javascript"
            starterCode={sampleJavaScriptCode}
            testCode={sampleJavaScriptTestCode}
            assignmentId="test-assignment-js-123"
            questionId="test-question-js-456"
            onTestComplete={handleTestComplete}
          />
        </div>
      </div>
    </div>
  );
};

export default TestJavaScriptPage;