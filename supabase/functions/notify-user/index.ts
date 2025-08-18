import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("notify-user function invoked");

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("Request body:", requestBody);

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    let message = '';
    let userId = '';
    let notificationType = '';
    let entityId = '';
    let link = '';
    let title = '';
    let type = '';
    let record: any = null;

    // Handle both trigger formats
    if (requestBody.table && requestBody.operation) {
      type = requestBody.operation;
      record = requestBody.record;

      switch (requestBody.table) {
        case 'assignments':
          record.table = 'assignments';
          break;
        case 'applied_jobs':
          record.table = 'applied_jobs';
          break;
        case 'messages':
          record.table = 'messages';
          break;
        default:
          record.table = requestBody.table;
      }
    } else if (requestBody.type && requestBody.record) {
      type = requestBody.type;
      record = requestBody.record;
    }

    if (!record) {
      console.error("Invalid request format - no record found");
      throw new Error("Invalid request format");
    }

    entityId = record.id; // default

    // Build notification payload by case
    switch (`${type}:${record.table}`) {
      case 'INSERT:assignments':
        console.log("Processing assignment notification for developer:", record.developer_id);
        title = `New Coding Test Assigned`;
        message = `You have been assigned a new coding test.`;
        userId = record.developer_id;
        notificationType = 'test_assignment';
        link = '?tab=tests';
        break;

      case 'UPDATE:assignments':
        if (record.status === 'completed') {
          console.log("Processing assignment completion notification");
          const { data: assignment, error: assignmentError } = await supabase
            .from('assignments')
            .select(`*, job_role:job_roles(recruiter_id, title)`)
            .eq('id', record.id)
            .single();
          if (assignmentError) {
            console.error("Error fetching assignment for completion notification:", assignmentError);
            break;
          }
          if (assignment?.job_role?.recruiter_id) {
            title = `Test Completed`;
            message = `A developer has completed a coding test you assigned for "${assignment.job_role.title}".`;
            userId = assignment.job_role.recruiter_id;
            notificationType = 'test_completion';
            entityId = record.id;
            link = '?tab=tracker';
            console.log("Test completion notification will be sent to recruiter:", userId);
          }
        }
        break;

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
            entityId = record.id;
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
        // Group by sender for read-tracking
        entityId = record.sender_id;

        // Also notify admins (unchanged behavior)
        {
          const { data: admins, error } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('role', 'admin');
          if (error) console.error("Error fetching admins:", error);
          if (admins && admins.length > 0) {
            for (const admin of admins) {
              if (admin.id !== userId) {
                await supabase.from('notifications').insert({
                  user_id: admin.id,
                  message: `New message between users.`,
                  type: 'admin_message',
                  entity_id: record.id,
                  link: '?tab=messages',
                  title: 'New Message'
                });
              }
            }
          }
        }
        break;

      case 'INSERT:applied_jobs': {
        const { data: job, error: jobError } = await supabase
          .from('job_roles')
          .select('recruiter_id')
          .eq('id', record.job_id)
          .single();
        if (jobError) throw jobError;
        title = `New Job Application`;
        message = `A developer has applied for one of your jobs.`;
        userId = job.recruiter_id;
        notificationType = 'job_application';
        link = '?tab=my-jobs';
        break;
      }

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

      // Legacy/unused path kept for compatibility
      case 'INSERT:recruiter_profiles':
        if (record.status === 'pending') {
          const { data: admins, error } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('role', 'admin');
          if (error) throw error;
          if (admins && admins.length > 0) {
            for (const admin of admins) {
              await supabase.from('notifications').insert({
                user_id: admin.id,
                message: 'A new recruiter is pending approval.',
                type: 'pending_recruiter',
                entity_id: record.id,
                link: '?tab=recruiters',
                title: 'Recruiter Pending Approval'
              });
            }
          }
        }
        break;

      default:
        console.log(`No handler for: ${type}:${record.table}`);
        break;
    }

    // If this is a test assignment notification and the target is a recruiter, skip it.
    if (message && userId && notificationType === 'test_assignment') {
      const { data: targetUser, error: targetErr } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();
      if (targetErr) {
        console.warn('Could not load target user role, proceeding with default behavior.', targetErr);
      } else if (targetUser?.role === 'recruiter') {
        console.log('Skipping notification: recruiters do not receive test assignment notifications.', { userId, notificationType });
        return new Response(JSON.stringify({
          message: 'Skipped recruiter test-assignment notification'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Enforce in_app preference for the target user (developers + recruiters)
    if (message && userId && notificationType) {
      let allowInApp = true;

      try {
        // Check developer preferences first
        const { data: devPref, error: devErr } = await supabase
          .from('developers')
          .select('notification_preferences')
          .eq('user_id', userId)
          .maybeSingle();

        if (!devErr && devPref?.notification_preferences) {
          const inApp = (devPref.notification_preferences as any).in_app;
          if (typeof inApp === 'boolean') {
            allowInApp = inApp;
          }
        }

        // If still allowed or no dev prefs found, check recruiter preferences
        const { data: recPref, error: recErr } = await supabase
          .from('recruiters')
          .select('notification_preferences')
          .eq('user_id', userId)
          .maybeSingle();

        if (!recErr && recPref?.notification_preferences) {
          const inApp = (recPref.notification_preferences as any).in_app;
          if (typeof inApp === 'boolean') {
            allowInApp = inApp;
          }
        }
      } catch (e) {
        console.warn('Could not load in_app preference; defaulting to allow.', e);
      }

      if (!allowInApp) {
        console.log('Skipping in-app notification due to user in_app preference', {
          userId,
          notificationType
        });
        // Optional: enqueue email here if you want to send email when in-app is disabled.
        return new Response(JSON.stringify({
          message: 'In-app notification suppressed by user preference'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert notification
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
        title: title || message
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

    return new Response(JSON.stringify({ message: 'Notification processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error("Error in notify-user function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
