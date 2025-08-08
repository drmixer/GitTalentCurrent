import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req)=>{
  console.log("notify-user function invoked");
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { type, record } = await req.json();
    console.log("Request body:", {
      type,
      record
    });
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    let message = '';
    let userId = '';
    let notificationType = '';
    let entityId = record.id; // Default entity_id to the record's id
    let link = '';
    let title = '';

    switch(`${type}:${record.table}`){
      case 'INSERT:test_assignments':
        title = `New Coding Test Assigned`;
        message = `You have been assigned a new coding test.`;
        userId = record.developer_id;
        notificationType = 'test_assignment';
        link = '?tab=tests';
        break;
      case 'UPDATE:test_assignments':
        if (record.status === 'Completed') {
          const { data: assignment, error } = await supabase.from('assignments').select('recruiter_id').eq('test_assignment_id', record.id).single();
          if (error) throw error;
          title = `Test Completed`;
          message = `A developer has completed a coding test.`;
          userId = assignment.recruiter_id;
          notificationType = 'test_completion';
          link = '?tab=tracker';
        }
        break;
      case 'INSERT:messages':
        title = `New Message`;
        message = `You have a new message.`;
        userId = record.receiver_id;
        notificationType = 'message';
        link = '?tab=messages';
        // FIXED: Set entity_id to the sender's ID for correct "mark as read" grouping.
        entityId = record.sender_id;

        // Also notify admin
        const { data: admins, error } = await supabase.from('user_profiles').select('id').eq('role', 'admin');
        if (error) console.error("Error fetching admins:", error);
        if (admins && admins.length > 0) {
            for (const admin of admins) {
                if (admin.id !== userId) { // Don't notify admin if they are the receiver
                    await supabase.from('notifications').insert({
                        user_id: admin.id,
                        message: `New message between users.`,
                        type: 'admin_message',
                        entity_id: record.id,
                        link: '?tab=messages',
                        title: 'New Message',
                    });
                }
            }
        }
        break;
      case 'INSERT:applied_jobs':
        const { data: job, error } = await supabase.from('job_roles').select('recruiter_id').eq('id', record.job_id).single();
        if (error) throw error;
        title = `New Job Application`;
        message = `A developer has applied for one of your jobs.`;
        userId = job.recruiter_id;
        notificationType = 'job_application';
        link = '?tab=jobs';
        break;
      case 'UPDATE:applied_jobs':
        if (record.status === 'viewed') {
          title = `Application Viewed`;
          message = `Your application for a job has been viewed.`;
          userId = record.developer_id;
          notificationType = 'application_viewed';
          link = '?tab=jobs';
        } else if (record.status === 'hired') {
          title = `You've been hired!`;
          message = `Congratulations! You have been hired for a position.`;
          userId = record.developer_id;
          notificationType = 'hired';
          link = '?tab=jobs';
        }
        break;
      case 'INSERT:recruiter_profiles':
        if (record.status === 'pending') {
          const { data: admins, error } = await supabase.from('user_profiles').select('id').eq('role', 'admin');
          if (error) throw error;
          if (admins && admins.length > 0) {
            for (const admin of admins) {
              await supabase.from('notifications').insert({
                user_id: admin.id,
                message: 'A new recruiter is pending approval.',
                type: 'recruiter_pending',
                entity_id: record.id,
                link: '?tab=recruiters',
                title: 'Recruiter Pending Approval',
              });
            }
          }
        }
        break;
    }

    if (message && userId && notificationType) {
      const { data, error } = await supabase.from('notifications').insert({
        user_id: userId,
        message,
        type: notificationType,
        entity_id: entityId,
        link,
        title: title || message, // Use specific title, fallback to message
      });

      if (error) {
        console.error("Error inserting notification:", error);
        throw error;
      }
      console.log("Notification inserted:", data);
    }

    return new Response(JSON.stringify({
      message: 'Notification processed'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
