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

    let notificationType = ''

    if (type === 'INSERT' && record.table === 'test_assignments') {
      // Notify developer
      message = `You have been assigned a new coding test.`
      userId = record.developer_id
      notificationType = 'test_assignment'
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
      notificationType = 'test_completion'
    } else if (type === 'INSERT' && record.table === 'messages') {
        // Notify receiver
        message = `You have a new message.`
        userId = record.receiver_id
        notificationType = 'message'
    } else if (type === 'INSERT' && record.table === 'applied_jobs') {
        // Notify recruiter
        const { data: job, error } = await supabase
            .from('job_roles')
            .select('recruiter_id')
            .eq('id', record.job_id)
            .single()

        if (error) {
            throw error
        }

        message = `A developer has applied for one of your jobs.`
        userId = job.recruiter_id
        notificationType = 'job_application'
    }

    if (message && userId) {
      await supabase.from('notifications').insert({
        user_id: userId,
        message,
        type: notificationType,
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
