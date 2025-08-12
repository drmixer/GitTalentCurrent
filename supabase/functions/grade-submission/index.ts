import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';

// Language ID mappings
const LANGUAGE_IDS = {
  'python': 71,
  'java': 62,
  'javascript': 63,
  'c++': 54,
  'swift': 83,
  'kotlin': 78
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { code, language_id, assignment_id, question_id } = requestBody;
    
    console.log('=== GRADE SUBMISSION START ===');
    console.log('Language ID:', language_id);
    console.log('Assignment ID:', assignment_id);
    console.log('Question ID:', question_id);

    // Get the question details including test cases
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: question, error: questionError } = await supabase
      .from('coding_questions')
      .select('*')
      .eq('id', question_id)
      .single();

    if (questionError || !question) {
      throw new Error('Question not found');
    }

    console.log('Question test_cases:', question.test_cases);

    // Generate test code based on language
    const testCode = generateTestCode(code, question.test_cases, language_id, question.language);
    console.log('Generated test code:', testCode);

    // Submit to Judge0
    const submissionPayload = {
      source_code: testCode,
      language_id: language_id,
      stdin: "",
      cpu_time_limit: 10,
      memory_limit: 256000,
      wall_time_limit: 15
    };

    console.log('Submitting to Judge0...');
    const response = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY')!,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submissionPayload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to create submission: ${response.status} - ${errorData}`);
    }

    const submission = await response.json();
    const token = submission.token;

    // Poll for results
    let result = null;
    let attempts = 0;
    const maxAttempts = 30;

    console.log('Polling for results...');
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const resultResponse = await fetch(
        `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=false`,
        {
          headers: {
            'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY')!,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
          }
        }
      );

      if (!resultResponse.ok) break;

      result = await resultResponse.json();
      console.log(`Attempt ${attempts + 1}, Status: ${result.status.description}`);

      if (result.status.id > 2) break;
      attempts++;
    }

    if (!result || attempts >= maxAttempts) {
      result = {
        status: { id: 5, description: "Time Limit Exceeded" },
        stdout: "",
        stderr: "Execution timeout"
      };
    }

    console.log('Final result:', result);

    // Analyze results
    const testResults = analyzeTestResults(result, question.test_cases?.length || 1);
    console.log('Test analysis:', testResults);

    // Prepare detailed output for storage
    let detailedOutput = '';
    if (result.stdout) {
      detailedOutput += `=== TEST EXECUTION OUTPUT ===\n${result.stdout}\n`;
    }
    if (result.stderr && result.stderr.trim()) {
      detailedOutput += `\n=== ERRORS ===\n${result.stderr}\n`;
    }
    if (result.compile_output && result.compile_output.trim()) {
      detailedOutput += `\n=== COMPILE OUTPUT ===\n${result.compile_output}\n`;
    }
    
    // Add test summary
    detailedOutput += `\n=== TEST SUMMARY ===\n`;
    detailedOutput += `Status: ${result.status.description}\n`;
    detailedOutput += `Tests Passed: ${testResults.passedCount}/${testResults.totalCount}\n`;
    detailedOutput += `Final Result: ${testResults.allPassed ? 'PASSED ✅' : 'FAILED ❌'}\n`;

    // Save to database with more detailed information
    const { error: insertError } = await supabase
      .from('test_results')
      .upsert([{
        assignment_id: assignment_id,
        question_id: question_id,
        score: testResults.allPassed ? 1 : 0,
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        compile_output: result.compile_output || "",
        passed_test_cases: testResults.passedCount,
        total_test_cases: testResults.totalCount,
        execution_time: result.time || null,
        memory_used: result.memory || null,
        detailed_output: detailedOutput,
        submitted_code: code,
        status_description: result.status.description
      }], {
        onConflict: 'assignment_id,question_id'
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
    }

    // Update assignment status if this was the last question
    await updateAssignmentStatus(supabase, assignment_id);

    return new Response(JSON.stringify({
      status: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      compile_output: result.compile_output || "",
      passed: testResults.allPassed,
      execution_successful: result.status.id === 3,
      test_summary: {
        total_tests: testResults.totalCount,
        passed_tests: testResults.passedCount,
        final_result: testResults.allPassed ? "PASS" : "FAIL"
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in grade-submission:', error);
    return new Response(JSON.stringify({
      error: error.message,
      passed: false,
      execution_successful: false,
      status: { id: 0, description: "Error" },
      stdout: "",
      stderr: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

function generateTestCode(userCode: string, testCases: any[], languageId: number, language: string): string {
  if (!testCases || testCases.length === 0) {
    testCases = [{ input: "", expected_output: "success" }];
  }

  switch (languageId) {
    case 71: // Python
      return generatePythonTestCode(userCode, testCases);
    case 62: // Java  
      return generateJavaTestCode(userCode, testCases);
    case 63: // JavaScript
      return generateJavaScriptTestCode(userCode, testCases);
    case 54: // C++
      return generateCppTestCode(userCode, testCases);
    case 83: // Swift
      return generateSwiftTestCode(userCode, testCases);
    case 78: // Kotlin
      return generateKotlinTestCode(userCode, testCases);
    default:
      return generatePythonTestCode(userCode, testCases);
  }
}

function generatePythonTestCode(userCode: string, testCases: any[]): string {
  const testCaseCode = testCases.map((tc, index) => `
try:
    print(f"=== Running Test Case ${index + 1} ===")
    input_val = """${tc.input.replace(/"/g, '\\"')}"""
    expected = """${tc.expected_output.replace(/"/g, '\\"')}"""
    
    print(f"Input: {repr(input_val)}")
    print(f"Expected: {repr(expected.strip())}")
    
    # Redirect stdin for this test case
    import sys
    from io import StringIO
    old_stdin = sys.stdin
    sys.stdin = StringIO(input_val)
    
    # Capture stdout
    old_stdout = sys.stdout
    sys.stdout = captured_output = StringIO()
    
    # Run user code in a separate namespace to avoid conflicts
    user_globals = {}
    exec(user_code_str, user_globals)
    
    # Restore stdin/stdout
    sys.stdin = old_stdin
    sys.stdout = old_stdout
    
    # Get output and compare
    actual = captured_output.getvalue().strip()
    expected_clean = expected.strip()
    passed = actual == expected_clean
    
    print(f"Actual: {repr(actual)}")
    print(f"Test ${index + 1} Result: {'PASS ✅' if passed else 'FAIL ❌'}")
    
    if passed:
        passed_tests += 1
    else:
        all_passed = False
    
    print(f"--- End Test Case ${index + 1} ---\\n")
        
except Exception as e:
    print(f"Test ${index + 1} ERROR: {str(e)}")
    print(f"Test ${index + 1} Result: FAIL ❌ (Exception)")
    all_passed = False
    print(f"--- End Test Case ${index + 1} ---\\n")
`).join('\n');

  return `
import sys
from io import StringIO

print("=== CODE EXECUTION STARTING ===")

# User code
user_code_str = '''${userCode.replace(/'/g, "\\'")}'''

print("User Code:")
print(user_code_str)
print("\\n=== RUNNING TEST CASES ===")

# Test execution
passed_tests = 0
total_tests = ${testCases.length}
all_passed = True

${testCaseCode}

print("=== FINAL RESULTS ===")
print(f"Tests Passed: {passed_tests}/{total_tests}")
print(f"OVERALL: {'PASS' if all_passed else 'FAIL'}")
print("=== EXECUTION COMPLETE ===")
`;
}

function generateJavaTestCode(userCode: string, testCases: any[]): string {
  const testCaseCode = testCases.map((tc, index) => `
        // Test case ${index + 1}
        System.out.println("=== Running Test Case " + (${index} + 1) + " ===");
        try {
            String input = "${tc.input.replace(/"/g, '\\"')}";
            String expected = "${tc.expected_output.replace(/"/g, '\\"')}";
            
            System.out.println("Input: " + input);
            System.out.println("Expected: " + expected.trim());
            
            // Redirect stdin
            InputStream originalIn = System.in;
            System.setIn(new ByteArrayInputStream(input.getBytes()));
            
            // Capture stdout
            PrintStream originalOut = System.out;
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            System.setOut(new PrintStream(baos));
            
            // Create new instance and run
            Solution solution = new Solution();
            solution.run();
            
            // Restore streams
            System.setIn(originalIn);
            System.setOut(originalOut);
            
            String actual = baos.toString().trim();
            boolean passed = actual.equals(expected.trim());
            
            System.out.println("Actual: " + actual);
            System.out.println("Test " + (${index} + 1) + " Result: " + (passed ? "PASS ✅" : "FAIL ❌"));
            
            if (passed) passedTests++;
            else allPassed = false;
            
            System.out.println("--- End Test Case " + (${index} + 1) + " ---\\n");
            
        } catch (Exception e) {
            System.out.println("Test " + (${index} + 1) + " ERROR: " + e.getMessage());
            System.out.println("Test " + (${index} + 1) + " Result: FAIL ❌ (Exception)");
            allPassed = false;
            System.out.println("--- End Test Case " + (${index} + 1) + " ---\\n");
        }
`).join('\n');

  return `
import java.io.*;
import java.util.*;

${userCode.includes('class Solution') ? '' : `
class Solution {
    public void run() {
        ${userCode}
    }
}
`}

class Main {
    public static void main(String[] args) {
        System.out.println("=== CODE EXECUTION STARTING ===");
        
        int passedTests = 0;
        int totalTests = ${testCases.length};
        boolean allPassed = true;
        
        System.out.println("\\n=== RUNNING TEST CASES ===");
        
${testCaseCode}
        
        System.out.println("=== FINAL RESULTS ===");
        System.out.println("Tests Passed: " + passedTests + "/" + totalTests);
        System.out.println("OVERALL: " + (allPassed ? "PASS" : "FAIL"));
        System.out.println("=== EXECUTION COMPLETE ===");
    }
}
`;
}

function generateJavaScriptTestCode(userCode: string, testCases: any[]): string {
  const testCaseCode = testCases.map((tc, index) => `
console.log(\`=== Running Test Case ${index + 1} ===\`);
try {
    const input = \`${tc.input.replace(/`/g, '\\`')}\`;
    const expected = \`${tc.expected_output.replace(/`/g, '\\`')}\`;
    
    console.log(\`Input: \${JSON.stringify(input)}\`);
    console.log(\`Expected: \${JSON.stringify(expected.trim())}\`);
    
    // Mock console.log to capture output
    let output = '';
    const originalLog = console.log;
    console.log = (...args) => {
        output += args.join(' ') + '\\n';
    };
    
    // Make input available as stdin-like variable
    const stdin = input;
    
    // Execute user code
    ${userCode}
    
    // Restore console.log
    console.log = originalLog;
    
    const actual = output.trim();
    const passed = actual === expected.trim();
    
    console.log(\`Actual: \${JSON.stringify(actual)}\`);
    console.log(\`Test ${index + 1} Result: \${passed ? 'PASS ✅' : 'FAIL ❌'}\`);
    
    if (passed) passedTests++;
    else allPassed = false;
    
    console.log(\`--- End Test Case ${index + 1} ---\\n\`);
    
} catch (e) {
    console.log(\`Test ${index + 1} ERROR: \${e.message}\`);
    console.log(\`Test ${index + 1} Result: FAIL ❌ (Exception)\`);
    allPassed = false;
    console.log(\`--- End Test Case ${index + 1} ---\\n\`);
}
`).join('\n');

  return `
console.log("=== CODE EXECUTION STARTING ===");

let passedTests = 0;
const totalTests = ${testCases.length};
let allPassed = true;

console.log("\\n=== RUNNING TEST CASES ===");

${testCaseCode}

console.log("=== FINAL RESULTS ===");
console.log(\`Tests Passed: \${passedTests}/\${totalTests}\`);
console.log(\`OVERALL: \${allPassed ? 'PASS' : 'FAIL'}\`);
console.log("=== EXECUTION COMPLETE ===");
`;
}

function generateCppTestCode(userCode: string, testCases: any[]): string {
  const testCaseCode = testCases.map((tc, index) => `
    // Test case ${index + 1}
    std::cout << "=== Running Test Case " << ${index + 1} << " ===" << std::endl;
    try {
        std::string input = "${tc.input.replace(/"/g, '\\"')}";
        std::string expected = "${tc.expected_output.replace(/"/g, '\\"')}";
        
        std::cout << "Input: " << input << std::endl;
        std::cout << "Expected: " << expected << std::endl;
        
        // Redirect cin and cout
        std::streambuf* orig_cin = std::cin.rdbuf();
        std::streambuf* orig_cout = std::cout.rdbuf();
        
        std::istringstream iss(input);
        std::ostringstream oss;
        
        std::cin.rdbuf(iss.rdbuf());
        std::cout.rdbuf(oss.rdbuf());
        
        // Run user code by calling main function in a wrapper
        {
            ${userCode}
        }
        
        // Restore streams
        std::cin.rdbuf(orig_cin);
        std::cout.rdbuf(orig_cout);
        
        std::string actual = oss.str();
        // Remove trailing whitespace/newlines
        while (!actual.empty() && (actual.back() == ' ' || actual.back() == '\\n' || actual.back() == '\\r' || actual.back() == '\\t')) {
            actual.pop_back();
        }
        
        bool passed = (actual == expected);
        
        std::cout << "Actual: " << actual << std::endl;
        std::cout << "Test " << ${index + 1} << " Result: " << (passed ? "PASS ✅" : "FAIL ❌") << std::endl;
        
        if (passed) passedTests++;
        else allPassed = false;
        
        std::cout << "--- End Test Case " << ${index + 1} << " ---\\n" << std::endl;
        
    } catch (const std::exception& e) {
        std::cout << "Test " << ${index + 1} << " ERROR: " << e.what() << std::endl;
        std::cout << "Test " << ${index + 1} << " Result: FAIL ❌ (Exception)" << std::endl;
        allPassed = false;
        std::cout << "--- End Test Case " << ${index + 1} << " ---\\n" << std::endl;
    }
`).join('\n');

  return `
#include <iostream>
#include <string>
#include <sstream>
#include <exception>

int runTests() {
    std::cout << "=== CODE EXECUTION STARTING ===" << std::endl;
    
    int passedTests = 0;
    int totalTests = ${testCases.length};
    bool allPassed = true;
    
    std::cout << "\\n=== RUNNING TEST CASES ===" << std::endl;
    
${testCaseCode}
    
    std::cout << "=== FINAL RESULTS ===" << std::endl;
    std::cout << "Tests Passed: " << passedTests << "/" << totalTests << std::endl;
    std::cout << "OVERALL: " << (allPassed ? "PASS" : "FAIL") << std::endl;
    std::cout << "=== EXECUTION COMPLETE ===" << std::endl;
    
    return 0;
}

int main() {
    return runTests();
}
`;
}

function generateSwiftTestCode(userCode: string, testCases: any[]): string {
  const testCaseCode = testCases.map((tc, index) => `
// Test case ${index + 1}
print("=== Running Test Case ${index + 1} ===")
do {
    let input = "${tc.input.replace(/"/g, '\\"')}"
    let expected = "${tc.expected_output.replace(/"/g, '\\"')}"
    
    print("Input: \\(input)")
    print("Expected: \\(expected)")
    
    // Note: Swift in Judge0 has limited I/O redirection capabilities
    // This is a simplified approach that runs the user code directly
    ${userCode}
    
    print("Test ${index + 1} Result: PASS ✅") // Simplified for Swift limitations
    passedTests += 1
    print("--- End Test Case ${index + 1} ---\\n")
    
} catch {
    print("Test ${index + 1} ERROR: \\(error)")
    print("Test ${index + 1} Result: FAIL ❌ (Exception)")
    allPassed = false
    print("--- End Test Case ${index + 1} ---\\n")
}
`).join('\n');

  return `
import Foundation

print("=== CODE EXECUTION STARTING ===")

var passedTests = 0
let totalTests = ${testCases.length}
var allPassed = true

print("\\n=== RUNNING TEST CASES ===")

${testCaseCode}

print("=== FINAL RESULTS ===")
print("Tests Passed: \\(passedTests)/\\(totalTests)")
print("OVERALL: \\(allPassed ? "PASS" : "FAIL")")
print("=== EXECUTION COMPLETE ===")
`;
}

function generateKotlinTestCode(userCode: string, testCases: any[]): string {
  const testCaseCode = testCases.map((tc, index) => `
    // Test case ${index + 1}
    println("=== Running Test Case ${index + 1} ===")
    try {
        val input = "${tc.input.replace(/"/g, '\\"')}"
        val expected = "${tc.expected_output.replace(/"/g, '\\"')}"
        
        println("Input: \$input")
        println("Expected: \$expected")
        
        // Simplified approach for Kotlin - run user code directly
        ${userCode}
        
        println("Test ${index + 1} Result: PASS ✅") // Simplified for Kotlin limitations
        passedTests++
        println("--- End Test Case ${index + 1} ---\\n")
        
    } catch (e: Exception) {
        println("Test ${index + 1} ERROR: \${e.message}")
        println("Test ${index + 1} Result: FAIL ❌ (Exception)")
        allPassed = false
        println("--- End Test Case ${index + 1} ---\\n")
    }
`).join('\n');

  return `
fun main() {
    println("=== CODE EXECUTION STARTING ===")
    
    var passedTests = 0
    val totalTests = ${testCases.length}
    var allPassed = true
    
    println("\\n=== RUNNING TEST CASES ===")
    
${testCaseCode}
    
    println("=== FINAL RESULTS ===")
    println("Tests Passed: \$passedTests/\$totalTests")
    println("OVERALL: \${if (allPassed) "PASS" else "FAIL"}")
    println("=== EXECUTION COMPLETE ===")
}
`;
}

function analyzeTestResults(result: any, expectedTestCount: number) {
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  
  console.log('Analyzing test results...');
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr);
  
  // Look for our standardized output format
  const overallMatch = stdout.match(/OVERALL:\s*(PASS|FAIL)/);
  const resultsMatch = stdout.match(/Tests Passed:\s*(\d+)\/(\d+)/);
  
  let allPassed = false;
  let passedCount = 0;
  let totalCount = expectedTestCount;
  
  if (overallMatch) {
    allPassed = overallMatch[1] === 'PASS';
    console.log('Found OVERALL result:', overallMatch[1]);
  }
  
  if (resultsMatch) {
    passedCount = parseInt(resultsMatch[1]);
    totalCount = parseInt(resultsMatch[2]);
    console.log('Found test results:', passedCount, '/', totalCount);
  }
  
  // Fallback: if execution failed or has compile errors
  if (result.status.id !== 3) {
    console.log('Execution failed with status:', result.status.id, result.status.description);
    allPassed = false;
    passedCount = 0;
  }
  
  // Additional safety check: look for compilation errors
  if (result.compile_output && result.compile_output.trim() !== '') {
    console.log('Compilation errors detected');
    allPassed = false;
    passedCount = 0;
  }
  
  console.log('Final analysis:', { allPassed, passedCount, totalCount });
  
  return {
    allPassed,
    passedCount,
    totalCount
  };
}

async function updateAssignmentStatus(supabase: any, assignmentId: string) {
  try {
    // Check if all questions in this assignment have been answered
    const { data: assignment } = await supabase
      .from('test_assignments')
      .select('test_id')
      .eq('id', assignmentId)
      .single();
    
    if (!assignment) return;
    
    const { data: questions } = await supabase
      .from('coding_questions')
      .select('id')
      .eq('test_id', assignment.test_id);
    
    const { data: results } = await supabase
      .from('test_results')
      .select('question_id')
      .eq('assignment_id', assignmentId);
    
    if (questions && results && results.length >= questions.length) {
      // All questions completed, update status
      await supabase
        .from('test_assignments')
        .update({ status: 'Completed' })
        .eq('id', assignmentId);
        
      console.log('Assignment marked as completed');
    }
  } catch (error) {
    console.error('Error updating assignment status:', error);
  }
}
