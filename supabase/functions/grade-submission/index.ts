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
    const { code, language_id, stdin, expected_output } = await req.json()

    const response = await fetch(`${JUDGE0_API_URL}/submissions`, {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY')!,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_code: code,
        language_id: language_id,
        stdin: stdin,
        expected_output: expected_output,
      }),
    })

    console.log('Judge0 request body:', {
        source_code: code,
        language_id: language_id,
        stdin: stdin,
        expected_output: expected_output,
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error(`Error from Judge0: ${response.status} ${errorData}`);
        throw new Error(`Failed to create submission on Judge0: ${response.status}`);
    }
    const submission = await response.json()
    const token = submission.token

    let processing = true
    let result = null

    while (processing) {
      const resultResponse = await fetch(`${JUDGE0_API_URL}/submissions/${token}`, {
        headers: {
          'X-RapidAPI-Key': Deno.env.get('JUDGE0_API_KEY')!,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        },
      })
      result = await resultResponse.json()
      if (result.status.id > 2) {
        processing = false
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
