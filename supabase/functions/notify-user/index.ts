import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, record } = await req.json()

    let message = ''

    if (type === 'INSERT' && record.table === 'test_assignments') {
      // Notify developer
      message = `You have been assigned a new coding test.`
      console.log(`Notifying developer ${record.developer_id}: ${message}`)
    } else if (type === 'UPDATE' && record.table === 'test_assignments' && record.status === 'Completed') {
      // Notify recruiter
      message = `A developer has completed a coding test.`
      console.log(`Notifying recruiter for assignment ${record.id}: ${message}`)
    }

    return new Response(JSON.stringify({ message: 'Notification processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
