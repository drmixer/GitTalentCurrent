import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
function isTypeAllowed(prefs, type) {
  // If a specific type flag exists and is false, block; otherwise allow by default
  if (prefs?.types && Object.prototype.hasOwnProperty.call(prefs.types, type)) {
    return !!prefs.types[type];
  }
  return true;
}
async function sendEmailViaResend(to, subject, html, text) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('EMAIL_FROM') || 'GitTalent <noreply@gittalent.dev>';
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set; skipping email send.');
    return {
      skipped: true,
      reason: 'missing_api_key'
    };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM,
      to: [
        to
      ],
      subject,
      html,
      text
    })
  });
  if (!res.ok) {
    const errTxt = await res.text().catch(()=>'');
    console.error('Resend API error:', res.status, errTxt);
    throw new Error(`Resend API returned ${res.status}`);
  }
  return await res.json().catch(()=>({}));
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const requestBody = await req.json();
    console.log('📥 Webhook payload received:', JSON.stringify(requestBody, null, 2));
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    let message = '';
    let userId = '';
    let notificationType = '';
    let entityId = '';
    let linkForEmail = ''; // 🔧 FIX: Renamed from 'link' to 'linkForEmail' for clarity
    let title = '';
    let type = '';
    let record = null;
    let table;
    // 🔧 FIX: Handle the actual webhook payload structure
    if (requestBody.table && requestBody.operation && requestBody.record) {
      // This is the format your triggers are sending
      type = requestBody.operation;
      record = requestBody.record;
      table = requestBody.table;
      console.log('✅ Using trigger format:', {
        type,
        table,
        recordId: record?.id
      });
    } else if (requestBody.type && requestBody.record) {
      // Alternative format (if you have other webhooks)
      type = requestBody.type;
      record = requestBody.record;
      table = requestBody.table;
      console.log('✅ Using alternative format:', {
        type,
        table,
        recordId: record?.id
      });
    } else {
      console.error('❌ Unknown payload format:', requestBody);
      throw new Error('Invalid request: unrecognized payload format');
    }
    if (!record) {
      throw new Error('Invalid request: missing record');
    }
    entityId = record.id;
    // Router - Updated to handle the correct operation types
    switch(`${type}:${table || ''}`){
      case 'INSERT:assignments':
        title = 'New Coding Test Assigned';
        message = 'You have been assigned a new coding test.';
        userId = record.developer_id;
        notificationType = 'test_assignment';
        linkForEmail = '?tab=tests';
        console.log('📋 Processing assignment insert for developer:', userId);
        break;
      case 'UPDATE:assignments':
        if (record.status === 'completed') {
          const { data: assignment, error: assignmentError } = await supabase.from('assignments').select(`*, job_role:job_roles(recruiter_id, title)`).eq('id', record.id).single();
          if (assignmentError) {
            console.error('❌ Error fetching assignment for completion:', assignmentError);
            break;
          }
          if (assignment?.job_role?.recruiter_id) {
            title = 'Test Completed';
            message = `A developer has completed a coding test you assigned for "${assignment.job_role.title}".`;
            userId = assignment.job_role.recruiter_id;
            notificationType = 'test_completion';
            entityId = record.id;
            linkForEmail = '?tab=tracker';
            console.log('✅ Processing assignment completion for recruiter:', userId);
          }
        }
        break;
      case 'INSERT:test_assignments':
        title = 'New Coding Test Assigned';
        message = 'You have been assigned a new coding test.';
        userId = record.developer_id;
        notificationType = 'test_assignment';
        linkForEmail = '?tab=tests';
        console.log('📋 Processing test_assignment insert for developer:', userId);
        break;
      case 'UPDATE:test_assignments':
        if (record.status === 'Completed') {
          // 🔧 FIX: Use 'job_id' instead of 'job_role_id' based on the actual webhook payload
          const { data: jobRole, error: jobError } = await supabase.from('job_roles').select('recruiter_id, title').eq('id', record.job_id).single();
          if (jobError) {
            console.error('❌ Error fetching job role for test completion:', jobError);
            break;
          }
          if (jobRole?.recruiter_id) {
            title = 'Test Completed';
            message = 'A developer has completed a coding test you assigned.';
            userId = jobRole.recruiter_id;
            notificationType = 'test_completion';
            entityId = record.id;
            linkForEmail = '?tab=tracker';
            console.log('✅ Processing test_assignment completion for recruiter:', userId);
          }
        }
        break;
      case 'INSERT:messages':
        title = 'New Message';
        message = 'You have a new message.';
        userId = record.receiver_id;
        notificationType = 'message';
        linkForEmail = '?tab=messages';
        entityId = record.sender_id;
        console.log('💬 Processing message insert for receiver:', userId, 'from sender:', record.sender_id);
        // Also notify admins (existing behavior)
        {
          const { data: admins } = await supabase.from('user_profiles').select('id').eq('role', 'admin');
          if (admins && admins.length > 0) {
            for (const admin of admins){
              if (admin.id !== userId) {
                // 🔧 FIX: Removed 'link' field from admin notification insert
                await supabase.from('notifications').insert({
                  user_id: admin.id,
                  message: 'New message between users.',
                  type: 'admin_message',
                  entity_id: record.id,
                  entity_type: 'messages',
                  title: 'New Message'
                });
                console.log('📢 Notified admin:', admin.id);
              }
            }
          }
        }
        break;
      case 'INSERT:applied_jobs':
        {
          const { data: job } = await supabase.from('job_roles').select('recruiter_id').eq('id', record.job_id).single();
          if (!job) {
            console.error('❌ Job not found for application:', record.job_id);
            break;
          }
          title = 'New Job Application';
          message = 'A developer has applied for one of your jobs.';
          userId = job.recruiter_id;
          notificationType = 'job_application';
          linkForEmail = '?tab=my-jobs';
          console.log('🎯 Processing job application for recruiter:', userId);
          break;
        }
      case 'UPDATE:applied_jobs':
        if (record.status === 'viewed') {
          title = 'Application Viewed';
          message = 'Your application for a job has been viewed.';
          userId = record.developer_id;
          notificationType = 'application_viewed';
          linkForEmail = '?tab=jobs';
          console.log('👀 Processing application viewed for developer:', userId);
        } else if (record.status === 'hired') {
          title = `You've been hired!`;
          message = 'Congratulations! You have been hired for a position.';
          userId = record.developer_id;
          notificationType = 'hired';
          linkForEmail = '?tab=jobs';
          console.log('🎉 Processing hire notification for developer:', userId);
        }
        break;
      // New: Endorsements -> notify developer
      case 'INSERT:endorsements':
        title = 'New Endorsement';
        message = 'You received a new endorsement.';
        userId = record.developer_id;
        notificationType = 'endorsement';
        linkForEmail = '?tab=overview';
        console.log('⭐ Processing endorsement for developer:', userId);
        break;
      // Legacy compatibility
      case 'INSERT:recruiter_profiles':
        if (record.status === 'pending') {
          const { data: admins, error } = await supabase.from('user_profiles').select('id').eq('role', 'admin');
          if (!error && admins?.length) {
            for (const admin of admins){
              // 🔧 FIX: Removed 'link' field from admin notification insert
              await supabase.from('notifications').insert({
                user_id: admin.id,
                message: 'A new recruiter is pending approval.',
                type: 'pending_recruiter',
                entity_id: record.id,
                entity_type: 'recruiter_profiles',
                title: 'Recruiter Pending Approval'
              });
            }
            console.log('👨‍💼 Notified admins about pending recruiter');
          }
        }
        break;
      default:
        console.log('🤷‍♂️ No handler for:', `${type}:${table || ''}`);
        break;
    }
    // If nothing to send, exit early
    if (!message || !userId || !notificationType) {
      console.log('⏭️ No notification to send:', {
        message: !!message,
        userId: !!userId,
        notificationType
      });
      return new Response(JSON.stringify({
        message: 'No-op'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('🎯 Preparing notification:', {
      userId,
      notificationType,
      title,
      entityId
    });
    // Load target user (role + email) once for downstream logic
    const { data: targetUser } = await supabase.from('users').select('id, role, email, name').eq('id', userId).maybeSingle();
    console.log('👤 Target user:', {
      id: targetUser?.id,
      role: targetUser?.role,
      email: !!targetUser?.email
    });
    // Skip test-assignment notifications aimed at recruiters
    if (notificationType === 'test_assignment' && targetUser?.role === 'recruiter') {
      console.log('⚠️ Skipping test_assignment notification for recruiter');
      return new Response(JSON.stringify({
        message: 'Skipped recruiter test-assignment notification'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Deliver channels according to preferences
    // Load preferences once (developer + recruiter tables)
    let devPrefs = null;
    let recPrefs = null;
    try {
      const [{ data: d }, { data: r }] = await Promise.all([
        supabase.from('developers').select('notification_preferences').eq('user_id', userId).maybeSingle(),
        supabase.from('recruiters').select('notification_preferences').eq('user_id', userId).maybeSingle()
      ]);
      devPrefs = d?.notification_preferences || null;
      recPrefs = r?.notification_preferences || null;
    } catch (e) {
      console.warn('Could not load preferences; defaulting to allow in-app/email.', e);
    }
    const allowType = isTypeAllowed(devPrefs, notificationType) && isTypeAllowed(recPrefs, notificationType);
    const allowInApp = allowType && (typeof devPrefs?.in_app === 'boolean' ? devPrefs?.in_app : true) && (typeof recPrefs?.in_app === 'boolean' ? recPrefs?.in_app : true);
    const allowEmail = allowType && ((typeof devPrefs?.email === 'boolean' ? devPrefs?.email : false) || (typeof recPrefs?.email === 'boolean' ? recPrefs?.email : false));
    console.log('🔐 Preferences:', {
      allowType,
      allowInApp,
      allowEmail
    });
    // 🔧 FIX: Insert in-app notification WITHOUT the 'link' field
    if (allowInApp) {
      console.log('📱 Creating in-app notification...');
      const { data: insertedNotification, error: insertError } = await supabase.from('notifications').insert({
        user_id: userId,
        message,
        type: notificationType,
        entity_id: entityId,
        entity_type: table,
        title: title || message
      }).select().single();
      if (insertError) {
        console.error('❌ Failed to insert in-app notification:', insertError);
      } else {
        console.log('✅ In-app notification created:', insertedNotification.id);
      }
    } else {
      console.log('📱❌ In-app notification suppressed by user preference', {
        userId,
        notificationType
      });
    }
    // Send email if allowed and we have an address
    if (allowEmail && targetUser?.email) {
      console.log('📧 Sending email notification...');
      const APP_BASE_URL = Deno.env.get('APP_BASE_URL')?.replace(/\/+$/, '') || '';
      // Pick a base route by role
      const routeBase = targetUser.role === 'recruiter' ? 'recruiter' : targetUser.role === 'admin' ? 'admin' : 'developer';
      // 🔧 FIX: Use linkForEmail instead of link for email generation
      const subPath = linkForEmail ? linkForEmail.startsWith('?') ? `/${routeBase}${linkForEmail}` : linkForEmail.startsWith('/') ? linkForEmail : `/${linkForEmail}` : `/${routeBase}`;
      const fullLink = APP_BASE_URL ? `${APP_BASE_URL}${subPath}` : '';
      // 🎨 Enhanced email content with more details
      let enhancedMessage = message;
      let actionText = 'View Details';
      // Add specific details based on notification type
      if (notificationType === 'message') {
        // Get sender details for message notifications
        const { data: sender } = await supabase.from('users').select('name, email').eq('id', record.sender_id).single();
        const senderName = sender?.name || sender?.email?.split('@')[0] || 'Someone';
        enhancedMessage = `You received a new message from ${senderName}.`;
        // Include message preview if it's short enough
        if (record.body && record.body.length <= 100) {
          enhancedMessage += `\n\n"${record.body}"`;
        }
        actionText = 'View Message';
      } else if (notificationType === 'test_assignment') {
        // Get test/job details for assignment notifications
        const { data: testDetails } = await supabase.from('test_assignments').select(`
            *,
            test:coding_tests(title),
            job:job_roles(title, company)
          `).eq('id', record.id).single();
        if (testDetails?.test?.title && testDetails?.job?.title) {
          enhancedMessage = `You've been assigned the coding test "${testDetails.test.title}" for the position "${testDetails.job.title}"`;
          if (testDetails.job.company) {
            enhancedMessage += ` at ${testDetails.job.company}`;
          }
          enhancedMessage += '.';
        }
        actionText = 'Start Test';
      } else if (notificationType === 'test_completion') {
        // Get developer details for completion notifications
        const { data: developer } = await supabase.from('users').select('name, email').eq('id', record.developer_id).single();
        const developerName = developer?.name || developer?.email?.split('@')[0] || 'A developer';
        enhancedMessage = `${developerName} has completed a coding test you assigned.`;
        actionText = 'View Results';
      } else if (notificationType === 'job_application') {
        // Get developer and job details for application notifications
        const { data: applicant } = await supabase.from('users').select('name, email').eq('id', record.developer_id).single();
        const { data: jobDetails } = await supabase.from('job_roles').select('title, company').eq('id', record.job_id).single();
        const applicantName = applicant?.name || applicant?.email?.split('@')[0] || 'A developer';
        if (jobDetails?.title) {
          enhancedMessage = `${applicantName} has applied for your "${jobDetails.title}" position`;
          if (jobDetails.company) {
            enhancedMessage += ` at ${jobDetails.company}`;
          }
          enhancedMessage += '.';
        }
        actionText = 'View Application';
      }
      const emailSubject = title || 'Notification';
      const emailText = `${enhancedMessage}${fullLink ? `\n\nOpen: ${fullLink}` : ''}`;
      // 🎨 Beautiful styled HTML email
      const emailHtml = `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; margin: 0;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 10px rgba(0,0,0,0.08); text-align: center;">
      
      <img src="https://gittalent.dev/logo.png" alt="GitTalent" style="max-width: 150px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
      
      <h2 style="color: #4f46e5; margin-bottom: 16px; font-size: 24px;">${title}</h2>
      
      <div style="color: #374151; line-height: 1.6; margin-bottom: 24px; white-space: pre-line;">
        ${enhancedMessage}
      </div>
      
      ${fullLink ? `
      <p style="margin: 24px 0;">
        <a href="${fullLink}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block; font-weight: 500;">
          ${actionText}
        </a>
      </p>
      ` : ''}
      
      <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 20px;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          You're receiving this because you have notifications enabled in your GitTalent account.
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          © 2025 GitTalent · <a href="https://gittalent.dev" style="color: #4f46e5; text-decoration: none;">Visit our site</a>
        </p>
      </div>
      
    </div>
  </body>
</html>
      `;
      try {
        await sendEmailViaResend(targetUser.email, emailSubject, emailHtml, emailText);
        console.log('✅ Notification email sent via Resend to', targetUser.email, 'type:', notificationType);
      } catch (e) {
        console.error('❌ Failed to send notification email via Resend:', e);
      }
    } else {
      console.log('📧❌ Email notification skipped:', {
        allowEmail,
        hasEmail: !!targetUser?.email
      });
    }
    console.log('🎉 Notification processing complete');
    return new Response(JSON.stringify({
      ok: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('💥 notify-user error:', error);
    return new Response(JSON.stringify({
      error: error?.message || 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
