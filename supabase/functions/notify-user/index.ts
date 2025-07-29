import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, record } = await req.json()
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let message = ''
    let userId = ''

    if (type === 'INSERT' && record.table === 'test_assignments') {
      // Notify developer
      message = `You have been assigned a new coding test.`
      userId = record.developer_id
    } else if (type === 'UPDATE' && record.table === 'test_assignments' && record.status === 'Completed') {
      // Notify recruiter
      const { data: assignment, error } = await supabase
        .from('assignments')
        .select('recruiter_id')
        .eq('test_assignment_id', record.id)
        .single()

      if (error) {
        throw error
      }

      message = `A developer has completed a coding test.`
      userId = assignment.recruiter_id
    }

    if (message && userId) {
      await supabase.from('notifications').insert({
        user_id: userId,
        message,
        type: 'test_assignment',
        entity_id: record.id,
      })
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
