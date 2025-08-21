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
function createStyledEmailTemplate(title, content, buttonText, buttonLink, preview) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 10px rgba(0,0,0,0.08); text-align: center;">
          
          <img src="https://gittalent.dev/logo.png" alt="GitTalent" style="max-width: 150px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
          
          <h2 style="color: #4f46e5; margin-bottom: 16px;">${title}</h2>
          
          ${preview ? `<p style="color: #6b7280; font-size: 14px; margin-bottom: 16px; font-style: italic;">${preview}</p>` : ''}
          
          <div style="color: #374151; text-align: left; margin-bottom: 24px;">
            ${content}
          </div>
          
          <p style="margin: 24px 0;">
            <a href="${buttonLink}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; display: inline-block;">
              ${buttonText}
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            © 2025 GitTalent · <a href="https://gittalent.dev" style="color: #4f46e5; text-decoration: none;">Visit our site</a>
          </p>
          
        </div>
      </body>
    </html>
  `;
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
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    let message = '';
    let userId = '';
    let notificationType = '';
    let entityId = '';
    let link = '';
    let title = '';
    let type = '';
    let record = null;
    let table;
    let emailContent = '';
    let emailSubject = '';
    // Support multiple trigger formats
    if (requestBody.table && requestBody.operation) {
      type = requestBody.operation;
      record = requestBody.record;
      table = requestBody.table;
    } else if (requestBody.type && requestBody.record) {
      type = requestBody.type;
      record = requestBody.record;
      table = record?.table || record?.schema || undefined;
    }
    if (!record) {
      throw new Error('Invalid request: missing record');
    }
    entityId = record.id;
    // Normalize table when possible
    if (!table && record.table) table = record.table;
    // Router
    switch(`${type}:${table || record.table || ''}`){
      case 'INSERT:assignments':
        // Fetch assignment details with recruiter and job info
        const { data: assignmentData } = await supabase.from('assignments').select(`
            *,
            job_role:job_roles(title, company, recruiter_id),
            recruiter:users!job_roles(name)
          `).eq('id', record.id).single();
        title = 'New Coding Test Assigned';
        message = assignmentData?.job_role?.title ? `You have been assigned a new coding test for "${assignmentData.job_role.title}".` : 'You have been assigned a new coding test.';
        userId = record.developer_id;
        notificationType = 'test_assignment';
        link = '?tab=tests';
        entityId = record.id;
        if (assignmentData) {
          emailSubject = `New Coding Test: ${assignmentData.job_role?.title || 'Position'}`;
          emailContent = `
            <p>You have been assigned a new coding test!</p>
            <p><strong>Position:</strong> ${assignmentData.job_role?.title || 'N/A'}</p>
            <p><strong>Company:</strong> ${assignmentData.job_role?.company || 'N/A'}</p>
            <p><strong>From:</strong> ${assignmentData.recruiter?.name || 'Recruiter'}</p>
            <p>Complete your test to proceed with the application process.</p>
          `;
        }
        break;
      case 'UPDATE:assignments':
        if (record.status === 'completed') {
          const { data: assignment, error: assignmentError } = await supabase.from('assignments').select(`
              *, 
              job_role:job_roles(recruiter_id, title, company),
              developer:users(name, email)
            `).eq('id', record.id).single();
          if (assignmentError || !assignment?.job_role?.recruiter_id) break;
          title = 'Test Completed';
          message = `${assignment.developer?.name || 'A developer'} has completed a coding test for "${assignment.job_role.title}".`;
          userId = assignment.job_role.recruiter_id;
          notificationType = 'test_completion';
          entityId = record.id;
          link = '?tab=tracker';
          emailSubject = `Test Completed: ${assignment.job_role.title}`;
          emailContent = `
            <p>Great news! A developer has completed the coding test you assigned.</p>
            <p><strong>Developer:</strong> ${assignment.developer?.name || 'N/A'}</p>
            <p><strong>Position:</strong> ${assignment.job_role.title}</p>
            <p><strong>Company:</strong> ${assignment.job_role.company || 'N/A'}</p>
            <p>Review their submission and next steps in your recruiter dashboard.</p>
          `;
        }
        break;
      case 'INSERT:test_assignments':
        // Fetch test assignment details
        const { data: testAssignmentData } = await supabase.from('test_assignments').select(`
            *,
            job_role:job_roles(title, company, recruiter_id),
            recruiter:users!job_roles(name)
          `).eq('id', record.id).single();
        title = 'New Coding Test Assigned';
        message = testAssignmentData?.job_role?.title ? `You have been assigned a new coding test for "${testAssignmentData.job_role.title}".` : 'You have been assigned a new coding test.';
        userId = record.developer_id;
        notificationType = 'test_assignment';
        link = '?tab=tests';
        entityId = record.id;
        if (testAssignmentData) {
          emailSubject = `New Coding Test: ${testAssignmentData.job_role?.title || 'Position'}`;
          emailContent = `
            <p>You have been assigned a new coding test!</p>
            <p><strong>Position:</strong> ${testAssignmentData.job_role?.title || 'N/A'}</p>
            <p><strong>Company:</strong> ${testAssignmentData.job_role?.company || 'N/A'}</p>
            <p><strong>From:</strong> ${testAssignmentData.recruiter?.name || 'Recruiter'}</p>
            <p>Complete your test to proceed with the application process.</p>
          `;
        }
        break;
      case 'UPDATE:test_assignments':
        if (record.status === 'Completed') {
          // Fetch job role and developer details
          const [{ data: jobRole }, { data: developer }] = await Promise.all([
            supabase.from('job_roles').select('recruiter_id, title, company').eq('id', record.job_role_id).single(),
            supabase.from('users').select('name, email').eq('id', record.developer_id).single()
          ]);
          if (!jobRole?.recruiter_id) break;
          title = 'Test Completed';
          message = `${developer?.name || 'A developer'} has completed a coding test for "${jobRole.title}".`;
          userId = jobRole.recruiter_id;
          notificationType = 'test_completion';
          entityId = record.id;
          link = '?tab=tracker';
          emailSubject = `Test Completed: ${jobRole.title}`;
          emailContent = `
            <p>Great news! A developer has completed the coding test you assigned.</p>
            <p><strong>Developer:</strong> ${developer?.name || 'N/A'}</p>
            <p><strong>Position:</strong> ${jobRole.title}</p>
            <p><strong>Company:</strong> ${jobRole.company || 'N/A'}</p>
            <p>Review their submission and next steps in your recruiter dashboard.</p>
          `;
        }
        break;
      case 'INSERT:messages':
        // Fetch sender details and message content
        const [{ data: sender }, { data: messageData }] = await Promise.all([
          supabase.from('users').select('name, email').eq('id', record.sender_id).single(),
          supabase.from('messages').select('content, subject').eq('id', record.id).single()
        ]);
        title = 'New Message';
        message = `You have a new message from ${sender?.name || 'a user'}.`;
        userId = record.receiver_id;
        notificationType = 'message';
        link = '?tab=messages';
        entityId = record.sender_id; // Use sender_id for entity_id for messages
        emailSubject = messageData?.subject || 'New Message on GitTalent';
        const messagePreview = messageData?.content ? messageData.content.length > 150 ? messageData.content.substring(0, 150) + '...' : messageData.content : '';
        emailContent = `
          <p>You have received a new message from <strong>${sender?.name || 'a user'}</strong>.</p>
          ${messageData?.content ? `
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0; text-align: left;">
              <p style="margin: 0; color: #374151; font-style: italic;">"${messagePreview}"</p>
            </div>
          ` : ''}
          <p>Click below to read the full message and reply.</p>
        `;
        // Also notify admins (existing behavior)
        {
          const { data: admins } = await supabase.from('user_profiles').select('id').eq('role', 'admin');
          if (admins && admins.length > 0) {
            for (const admin of admins){
              if (admin.id !== userId) {
                await supabase.from('notifications').insert({
                  user_id: admin.id,
                  message: 'New message between users.',
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
      case 'INSERT:applied_jobs':
        {
          // Fetch both job and developer details
          const [{ data: job }, { data: developer }] = await Promise.all([
            supabase.from('job_roles').select('recruiter_id, title, company, location').eq('id', record.job_id).single(),
            supabase.from('users').select('name, email').eq('id', record.developer_id).single()
          ]);
          if (!job?.recruiter_id) break;
          title = 'New Job Application';
          message = `${developer?.name || 'A developer'} has applied for "${job.title}".`;
          userId = job.recruiter_id;
          notificationType = 'job_application';
          link = '?tab=my-jobs';
          entityId = record.id;
          emailSubject = `New Application: ${job.title}`;
          emailContent = `
          <p>You have received a new job application!</p>
          <p><strong>Developer:</strong> ${developer?.name || 'N/A'}</p>
          <p><strong>Position:</strong> ${job.title}</p>
          <p><strong>Company:</strong> ${job.company || 'N/A'}</p>
          <p><strong>Location:</strong> ${job.location || 'N/A'}</p>
          <p>Review the application and candidate profile in your recruiter dashboard.</p>
        `;
          break;
        }
      case 'UPDATE:applied_jobs':
        if (record.status === 'viewed') {
          title = 'Application Viewed';
          message = 'Your application for a job has been viewed.';
          userId = record.developer_id;
          notificationType = 'application_viewed';
          link = '?tab=jobs';
          entityId = record.id;
          emailSubject = 'Your Application Has Been Viewed';
          emailContent = `
            <p>Great news! A recruiter has viewed your job application.</p>
            <p>This means they're interested in learning more about you. Keep an eye out for potential follow-up communications.</p>
          `;
        } else if (record.status === 'hired') {
          title = `You've been hired!`;
          message = 'Congratulations! You have been hired for a position.';
          userId = record.developer_id;
          notificationType = 'hired';
          link = '?tab=jobs';
          entityId = record.id;
          emailSubject = 'Congratulations - You\'ve Been Hired!';
          emailContent = `
            <p>🎉 Congratulations! You have been hired for a position.</p>
            <p>This is an exciting milestone in your career. The recruiter should be in touch soon with next steps.</p>
            <p>Well done on securing this opportunity!</p>
          `;
        }
        break;
      // New: Endorsements -> notify developer
      case 'INSERT:endorsements':
        title = 'New Endorsement';
        message = 'You received a new endorsement.';
        userId = record.developer_id;
        notificationType = 'endorsement';
        link = '?tab=overview';
        entityId = record.id;
        emailSubject = 'New Endorsement Received';
        emailContent = `
          <p>You have received a new endorsement on your profile!</p>
          <p>Endorsements help showcase your skills and experience to potential employers.</p>
          <p>Check your profile to see the latest endorsement.</p>
        `;
        break;
      // Legacy compatibility
      case 'INSERT:recruiter_profiles':
        if (record.status === 'pending') {
          const { data: admins, error } = await supabase.from('user_profiles').select('id').eq('role', 'admin');
          if (!error && admins?.length) {
            for (const admin of admins){
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
        break;
    }
    // If nothing to send, exit early
    if (!message || !userId || !notificationType) {
      return new Response(JSON.stringify({
        message: 'No-op'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Load target user (role + email) once for downstream logic
    const { data: targetUser } = await supabase.from('users').select('id, role, email, name').eq('id', userId).maybeSingle();
    // Skip test-assignment notifications aimed at recruiters
    if (notificationType === 'test_assignment' && targetUser?.role === 'recruiter') {
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
    // Insert in-app notification if allowed
    if (allowInApp) {
      await supabase.from('notifications').insert({
        user_id: userId,
        message,
        type: notificationType,
        entity_id: entityId,
        link,
        title: title || message
      });
    } else {
      console.log('In-app suppressed by user preference', {
        userId,
        notificationType
      });
    }
    // Send email if allowed and we have an address
    if (allowEmail && targetUser?.email) {
      const APP_BASE_URL = Deno.env.get('APP_BASE_URL')?.replace(/\/+$/, '') || '';
      // Pick a base route by role
      const routeBase = targetUser.role === 'recruiter' ? 'recruiter' : targetUser.role === 'admin' ? 'admin' : 'developer';
      // link is usually a query string like "?tab=..." to append after /{routeBase}
      const subPath = link ? link.startsWith('?') ? `/${routeBase}${link}` : link.startsWith('/') ? link : `/${link}` : `/${routeBase}`;
      const fullLink = APP_BASE_URL ? `${APP_BASE_URL}${subPath}` : '';
      const subject = emailSubject || title || 'Notification';
      const text = `${message}${fullLink ? `\n\nOpen: ${fullLink}` : ''}`;
      // Use styled template if we have custom content, otherwise fall back to basic
      const html = emailContent ? createStyledEmailTemplate(title || 'Notification', emailContent, 'Open GitTalent', fullLink) : `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;">
            <p>${message}</p>
            ${fullLink ? `<p><a href="${fullLink}" target="_blank" rel="noopener noreferrer">Open in GitTalent</a></p>` : ''}
          </div>
        `;
      try {
        await sendEmailViaResend(targetUser.email, subject, html, text);
        console.log('Notification email sent via Resend to', targetUser.email, 'type:', notificationType);
      } catch (e) {
        console.error('Failed to send notification email via Resend:', e);
      }
    }
    return new Response(JSON.stringify({
      ok: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('notify-user error:', error);
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
