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
        console.log("Processing test assignment notification for developer:", record.developer_id);
        title = `New Coding Test Assigned`;
        message = `You have been assigned a new coding test.`;
        userId = record.developer_id;
        notificationType = 'test_assignment';
        link = '?tab=tests';
        break;
        
      case 'UPDATE:test_assignments':
        if (record.status === 'Completed') {
          console.log("Processing test completion notification");
          
          // Get the job role and recruiter info
          const { data: jobRole, error: jobError } = await supabase
            .from('job_roles')
            .select('recruiter_id, title')
            .eq('id', record.job_role_id)
            .single();
            
          if (jobError) {
            console.error("Error fetching job role for test completion:", jobError);
            throw jobError;
          }
          
          if (jobRole?.recruiter_id) {
            title = `Test Completed`;
            message = `A developer has completed a coding test you assigned.`;
            userId = jobRole.recruiter_id;
            notificationType = 'test_completion';
            entityId = record.id; // Use test_assignment ID as entity_id
            link = '?tab=tracker';
            console.log("Test completion notification will be sent to recruiter:", userId);
          }
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
        link = '?tab=my-jobs';
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
                type: 'pending_recruiter',
                entity_id: record.id,
                link: '?tab=recruiters',
                title: 'Recruiter Pending Approval',
              });
            }
          }
        }
        break;
        
      // NEW: Handle when assignments are created (when developer is assigned to test)
      case 'INSERT:assignments':
        if (record.test_assignment_id && record.developer_id) {
          console.log("Processing assignment notification for test assignment:", record.test_assignment_id);
          
          // Get the test assignment details
          const { data: testAssignment, error: testError } = await supabase
            .from('test_assignments')
            .select('*')
            .eq('id', record.test_assignment_id)
            .single();
            
          if (testError) {
            console.error("Error fetching test assignment for notification:", testError);
            break;
          }
          
          if (testAssignment) {
            title = `New Coding Test Assigned`;
            message = `You have been assigned a new coding test.`;
            userId = record.developer_id;
            notificationType = 'test_assignment';
            entityId = record.test_assignment_id; // Use test_assignment_id as entity_id
            link = '?tab=tests';
            console.log("Test assignment notification will be sent to developer:", userId);
          }
        }
        break;
        
      // UPDATED: Handle when assignments are completed (when developer completes test)
      case 'UPDATE:assignments':
        if (record.status === 'completed' && record.test_assignment_id) {
          console.log("Processing assignment completion notification for:", record.test_assignment_id);
          
          // Get the test assignment and job role details
          const { data: testAssignment, error: testError } = await supabase
            .from('test_assignments')
            .select(`
              *,
              job_role:job_roles(recruiter_id, title)
            `)
            .eq('id', record.test_assignment_id)
            .single();
            
          if (testError) {
            console.error("Error fetching test assignment for completion notification:", testError);
            break;
          }
          
          if (testAssignment?.job_role?.recruiter_id) {
            title = `Test Completed`;
            message = `A developer has completed a coding test you assigned for "${testAssignment.job_role.title}".`;
            userId = testAssignment.job_role.recruiter_id;
            notificationType = 'test_completion';
            entityId = record.id; // Use assignment ID as entity_id
            link = '?tab=tracker';
            console.log("Test completion notification will be sent to recruiter:", userId);
          }
        }
        break;
    }

    if (message && userId && notificationType) {
      console.log("Inserting notification:", {
        user_id: userId,
        message,
        type: notificationType,
        entity_id: entityId,
        link,
        title: title || message
      });
      
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
      console.log("Notification inserted successfully:", data);
    } else {
      console.log("No notification to send - missing required fields:", {
        message: !!message,
        userId: !!userId,
        notificationType: !!notificationType
      });
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
    console.error("Error in notify-user function:", error);
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
