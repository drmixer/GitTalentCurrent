import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    console.log('run-code request:', requestBody);
    const { code, language_id, stdin } = requestBody;

    // For test runs, we'll just execute the code with the provided stdin
    // without wrapping it in test harnesses
    const submissionPayload = {
      source_code: code,
      language_id: language_id,
      stdin: stdin || '',
      cpu_time_limit: 10,
      memory_limit: 256000,
      wall_time_limit: 15,
    };

    console.log('Judge0 submission payload:', submissionPayload);

    const response = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY')!,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submissionPayload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Judge0 submission error: ${response.status} ${errorData}`);
      throw new Error(`Failed to create submission: ${response.status}`);
    }

    const submission = await response.json();
    console.log('Judge0 submission created:', submission);
    const token = submission.token;

    // Poll for results
    let result = null;
    let attempts = 0;
    const maxAttempts = 30;

    console.log('Polling for execution results...');
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const resultResponse = await fetch(
        `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=false`,
        {
          headers: {
            'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY')!,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
        }
      );

      if (!resultResponse.ok) {
        console.error('Error fetching result:', resultResponse.status);
        break;
      }

      result = await resultResponse.json();
      console.log(`Polling attempt ${attempts + 1}, Status: ${result.status.description} (ID: ${result.status.id})`);

      // Status meanings:
      // 1: In Queue, 2: Processing, 3: Accepted, 4: Wrong Answer, 5: Time Limit Exceeded, 6: Compilation Error, etc.
      if (result.status.id > 2) {
        break; // Execution completed
      }
      
      attempts++;
    }

    if (attempts >= maxAttempts) {
      result = {
        status: { id: 5, description: "Time Limit Exceeded" },
        stdout: "",
        stderr: "Execution timeout - code took too long to run",
        compile_output: ""
      };
    }

    console.log('Final execution result:', result);

    // Return the raw execution result for test runs
    return new Response(JSON.stringify({
      status: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      compile_output: result.compile_output || "",
      execution_time: result.time,
      memory: result.memory,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in run-code function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: { id: 0, description: "Internal Error" },
      stdout: "",
      stderr: `Internal error: ${error.message}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
