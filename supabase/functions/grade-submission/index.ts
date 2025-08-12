import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const requestBody = await req.json();
    const { code, language_id, stdin, expected_output, assignment_id, question_id } = requestBody;
    let sourceCode = code;
    if (language_id === 62 || language_id === 91) {
      let processedCode = code.replace(/public\s+class/g, 'class');
      if (processedCode.includes('class Solution')) {
        let methodMatch = processedCode.match(/class Solution\s*\{([\s\S]*)\}/);
        let methodContent = methodMatch ? methodMatch[1].trim() : '';
        let testCode = '';
        if (methodContent.includes('reverseString')) {
          testCode = `
class Solution {
${methodContent}
}

class Main {
    public static void main(String[] args) {
        Solution solution = new Solution();

        String[] testCases = {"hello", "world", "Java", "abc", "", "a"};
        String[] expected = {"olleh", "dlrow", "avaJ", "cba", "", "a"};

        boolean allPassed = true;

        for (int i = 0; i < testCases.length; i++) {
            try {
                String result = solution.reverseString(testCases[i]);
                System.out.println(result);
                boolean passed = (result == null && expected[i] == null) ||
                                (result != null && result.equals(expected[i]));
                if (!passed) allPassed = false;
            } catch (Exception e) {
                System.out.println("ERROR: " + e.getMessage());
                allPassed = false;
            }
        }

        System.out.println();
        System.out.println(allPassed ? "PASS" : "FAIL");
        if (!allPassed) System.exit(1);
    }
}
`;
        } else if (methodContent.includes('add(')) {
          testCode = `
class Solution {
${methodContent}
}

class Main {
    public static void main(String[] args) {
        Solution solution = new Solution();

        int[][] testCases = {{1, 2}, {5, 7}, {-1, 1}, {0, 0}, {100, 200}};
        int[] expected = {3, 12, 0, 0, 300};

        boolean allPassed = true;

        for (int i = 0; i < testCases.length; i++) {
            try {
                int result = solution.add(testCases[i][0], testCases[i][1]);
                System.out.println(result);
                boolean passed = result == expected[i];
                if (!passed) allPassed = false;
            } catch (Exception e) {
                System.out.println("ERROR: " + e.getMessage());
                allPassed = false;
            }
        }

        System.out.println();
        System.out.println(allPassed ? "PASS" : "FAIL");
        if (!allPassed) System.exit(1);
    }
}
`;
        } else {
          if (stdin && stdin.trim()) {
            let testInput = stdin.replace(/public\s+class\s+Main\s*\{[\s\S]*?public\s+static\s+void\s+main\s*\([^)]*\)\s*\{/, '');
            testInput = testInput.replace(/\}\s*\}\s*$/, '');
            testCode = `
class Solution {
${methodContent}
}

class Main {
    public static void main(String[] args) {
${testInput}
    }
}
`;
          } else {
            testCode = `
class Solution {
${methodContent}
}

class Main {
    public static void main(String[] args) {
        System.out.println("PASS");
    }
}
`;
          }
        }
        sourceCode = testCode;
      }
    } else if (language_id === 71) {
      if (stdin && stdin.trim()) {
        sourceCode = `${code}\n\n${stdin}`;
      } else {
        sourceCode = `${code}\n\nprint("PASS")`;
      }
    } else if (language_id === 54) {
      if (stdin && stdin.trim()) {
        sourceCode = `${code}\n\n${stdin}`;
      } else {
        sourceCode = code;
      }
    } else if (language_id === 83) {
      if (stdin && stdin.trim()) {
        sourceCode = `${code}\n\n${stdin}`;
      } else {
        sourceCode = `${code}\n\nprint("PASS")`;
      }
    } else if (language_id === 78) {
      if (stdin && stdin.trim()) {
        sourceCode = `${code}\n\n${stdin}`;
      } else {
        if (!code.includes("fun main")) {
          sourceCode = `
fun main() {
${code}
}
print("PASS")
`;
        } else {
          sourceCode = `${code}\n\nprint("PASS")`;
        }
      }
    } else {
      sourceCode = code;
    }
    const submissionPayload = {
      source_code: sourceCode,
      language_id: language_id,
      stdin: "",
      cpu_time_limit: 2,
      memory_limit: 128000,
      wall_time_limit: 5,
      expected_output: null
    };
    const response = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY'),
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submissionPayload)
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to create submission on Judge0: ${response.status} - ${errorData}`);
    }
    const submission = await response.json();
    const token = submission.token;
    let processing = true;
    let result = null;
    let attempts = 0;
    const maxAttempts = 30;
    while(processing && attempts < maxAttempts){
      await new Promise((resolve)=>setTimeout(resolve, 1500));
      const resultResponse = await fetch(`${JUDGE0_API_URL}/submissions/${token}?base64_encoded=false`, {
        headers: {
          'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY'),
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
        }
      });
      if (!resultResponse.ok) {
        break;
      }
      result = await resultResponse.json();
      if (result.status.id > 2) {
        processing = false;
      }
      attempts++;
    }
    if (attempts >= maxAttempts) {
      result = {
        status: {
          id: 6,
          description: "Time Limit Exceeded"
        },
        stdout: "",
        stderr: "Execution timeout",
        compile_output: ""
      };
    }
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const isAccepted = result.status?.id === 3;
    const hasPassed = stdout.includes("PASS") && isAccepted;
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    if (assignment_id && question_id) {
      const { error: insertError } = await supabase.from('test_results').upsert([
        {
          assignment_id: assignment_id,
          question_id: question_id,
          score: hasPassed ? 1 : 0,
          stdout: stdout,
          stderr: stderr,
          passed_test_cases: hasPassed ? 1 : 0,
          total_test_cases: 1
        }
      ], {
        onConflict: 'assignment_id,question_id'
      });
      if (insertError) {
        throw new Error('Failed to save test result.');
      }
      const { data: testAssignment, error: updateError } = await supabase.from('test_assignments').update({
        status: 'Completed'
      }).eq('id', assignment_id).select().single();
      if (updateError) {
        throw new Error('Failed to update test assignment status.');
      }
      if (testAssignment) {
        await supabase.functions.invoke('notify-user', {
          body: {
            type: 'UPDATE',
            table: 'test_assignments',
            record: testAssignment
          }
        });
      }
    }
    return new Response(JSON.stringify({
      ...result,
      stdout,
      stderr,
      compile_output: result.compile_output || "",
      status_description: result.status?.description || "Unknown",
      passed: hasPassed,
      execution_successful: isAccepted,
      test_summary: {
        total_tests: 1,
        passed_tests: hasPassed ? 1 : 0,
        final_result: hasPassed ? "PASS" : "FAIL"
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString(),
      passed: false,
      execution_successful: false,
      status: {
        id: 0,
        description: "Error"
      },
      stdout: "",
      stderr: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
