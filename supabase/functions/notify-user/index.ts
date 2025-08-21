// supabase/functions/notify-user/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function isTypeAllowed(prefs, type) {
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
          <h2 style="color: #4f46e5; margin-bottom: 16px;">${escapeHtml(title)}</h2>
          ${preview ? `<p style="color: #6b7280; font-size: 14px; margin-bottom: 16px; font-style: italic;">${escapeHtml(preview)}</p>` : ''}
          <div style="color: #374151; text-align: left; margin-bottom: 24px;">
            ${content}
          </div>
          <p style="margin: 24px 0;">
            <a href="${buttonLink}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; display: inline-block;">
              ${escapeHtml(buttonText)}
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

function escapeHtml(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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
      to,
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
    let preview = '';

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
    if (!table && record.table) table = record.table;

    // Main router for notifications
    switch(`${type}:${table || record.table || ''}`){
      case 'INSERT:assignments': {
        const { data: assignment } = await supabase.from('assignments').select('*').eq('id', record.id).single();
        if (assignment) {
          const { data: jobRole } = await supabase.from('job_roles').select('title, recruiter_id').eq('id', assignment.job_role_id).single();
          if (jobRole) {
            const { data: recruiter } = await supabase.from('recruiters').select('company_name').eq('user_id', jobRole.recruiter_id).single();
            const { data: recruiterUser } = await supabase.from('users').select('name').eq('id', jobRole.recruiter_id).single();

            title = 'New Coding Test Assigned';
            message = `You have been assigned a new coding test for "${jobRole.title || 'a position'}".`;
            preview = message;
            userId = record.developer_id;
            notificationType = 'test_assignment';
            entityId = record.id;
            link = '?tab=tests';
            emailSubject = `New Coding Test: ${jobRole.title || 'Position'}`;
            emailContent = `
              <p>You have been assigned a new coding test!</p>
              <p><strong>Position:</strong> ${jobRole.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${recruiter?.company_name || 'N/A'}</p>
              <p><strong>From:</strong> ${recruiterUser?.name || 'Recruiter'}</p>
              <p>Complete your test to proceed with the application process.</p>
            `;
          }
        }
        break;
      }
      case 'UPDATE:assignments': {
        if (record.status === 'completed') {
          const { data: assignment } = await supabase.from('assignments').select('*').eq('id', record.id).single();
          if (assignment) {
             const { data: jobRole } = await supabase.from('job_roles').select('title, recruiter_id').eq('id', assignment.job_role_id).single();
             if (jobRole) {
                const { data: developer } = await supabase.from('users').select('name').eq('id', assignment.developer_id).single();
                const { data: recruiter } = await supabase.from('recruiters').select('company_name').eq('user_id', jobRole.recruiter_id).single();

                title = 'Test Completed';
                message = `${developer?.name || 'A developer'} has completed a coding test for "${jobRole.title}".`;
                preview = message;
                userId = jobRole.recruiter_id;
                notificationType = 'test_completion';
                entityId = record.id;
                link = '?tab=tracker';
                emailSubject = `Test Completed: ${jobRole.title}`;
                emailContent = `
                  <p>Great news! A developer has completed the coding test you assigned.</p>
                  <p><strong>Developer:</strong> ${developer?.name || 'N/A'}</p>
                  <p><strong>Position:</strong> ${jobRole.title}</p>
                  <p><strong>Company:</strong> ${recruiter?.company_name || 'N/A'}</p>
                  <p>Review their submission and next steps in your recruiter dashboard.</p>
                `;
             }
          }
        }
        break;
      }
      case 'INSERT:test_assignments': {
        const { data: testAssignment } = await supabase.from('test_assignments').select('*').eq('id', record.id).single();
        if (testAssignment) {
          const { data: jobRole } = await supabase.from('job_roles').select('title, recruiter_id').eq('id', testAssignment.job_id).single();
          if(jobRole) {
            const { data: recruiter } = await supabase.from('recruiters').select('company_name').eq('user_id', jobRole.recruiter_id).single();
            const { data: recruiterUser } = await supabase.from('users').select('name').eq('id', jobRole.recruiter_id).single();

            title = 'New Coding Test Assigned';
            message = `You have been assigned a new coding test for "${jobRole.title || 'a position'}".`;
            preview = message;
            userId = record.developer_id;
            notificationType = 'test_assignment';
            entityId = record.id;
            link = '?tab=tests';
            emailSubject = `New Coding Test: ${jobRole.title || 'Position'}`;
            emailContent = `
              <p>You have been assigned a new coding test!</p>
              <p><strong>Position:</strong> ${jobRole.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${recruiter?.company_name || 'N/A'}</p>
              <p><strong>From:</strong> ${recruiterUser?.name || 'Recruiter'}</p>
              <p>Complete your test to proceed with the application process.</p>
            `;
          }
        }
        break;
      }
      case 'UPDATE:test_assignments': {
        if (record.status === 'Completed') {
          const { data: testAssignment } = await supabase.from('test_assignments').select('*').eq('id', record.id).single();
          if(testAssignment) {
            const { data: jobRole } = await supabase.from('job_roles').select('recruiter_id, title').eq('id', testAssignment.job_id).single();
            if (jobRole) {
              const { data: developer } = await supabase.from('users').select('name').eq('id', testAssignment.developer_id).single();
              const { data: recruiter } = await supabase.from('recruiters').select('company_name').eq('user_id', jobRole.recruiter_id).single();
              title = 'Test Completed';
              message = `${developer?.name || 'A developer'} has completed a coding test for "${jobRole.title}".`;
              preview = message;
              userId = jobRole.recruiter_id;
              notificationType = 'test_completion';
              entityId = record.id;
              link = '?tab=tracker';
              emailSubject = `Test Completed: ${jobRole.title}`;
              emailContent = `
                <p>Great news! A developer has completed the coding test you assigned.</p>
                <p><strong>Developer:</strong> ${developer?.name || 'N/A'}</p>
                <p><strong>Position:</strong> ${jobRole.title}</p>
                <p><strong>Company:</strong> ${recruiter?.company_name || 'N/A'}</p>
                <p>Review their submission and next steps in your recruiter dashboard.</p>
              `;
            }
          }
        }
        break;
      }
      case 'INSERT:messages': {
        const [{ data: sender }, { data: messageData }] = await Promise.all([
          supabase.from('users').select('name, email').eq('id', record.sender_id).single(),
          supabase.from('messages').select('body, subject').eq('id', record.id).single()
        ]);
        if(sender && messageData) {
            title = 'New Message';
            message = `You have a new message from ${sender.name || 'a user'}.`;
            userId = record.receiver_id;
            notificationType = 'message';
            entityId = record.sender_id;
            link = '?tab=messages';
            emailSubject = messageData.subject || `New message from ${sender.name || 'a user'}`;
            preview = messageData.body ? messageData.body.substring(0, 150) + (messageData.body.length > 150 ? '...' : '') : '';
            emailContent = `
              <p>You have received a new message from <strong>${sender.name || 'a user'}</strong>.</p>
              ${messageData.body ? `
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0; text-align: left;">
                  <p style="margin: 0; color: #374151; font-style: italic;">"${escapeHtml(preview)}"</p>
                </div>
              ` : ''}
              <p>Click below to read the full message and reply.</p>
            `;

            const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
            if (admins && admins.length > 0) {
              for (const admin of admins){
                if (admin.id !== userId) {
                  await supabase.from('notifications').insert({
                    user_id: admin.id,
                    message: `New message from ${sender.name || 'a user'} to ${messageData.subject ? 'regarding ' + messageData.subject : 'another user'}.`,
                    type: 'admin_message',
                    entity_id: record.id,
                    link: '?tab=messages',
                    title: 'New Message Activity'
                  });
                }
              }
            }
        }
        break;
      }
      case 'INSERT:applied_jobs': {
        const { data: job } = await supabase.from('job_roles').select('recruiter_id, title, location').eq('id', record.job_id).single();
        if (job) {
          const { data: developer } = await supabase.from('users').select('name').eq('id', record.developer_id).single();
          const { data: recruiter } = await supabase.from('recruiters').select('company_name').eq('user_id', job.recruiter_id).single();
          title = 'New Job Application';
          message = `${developer?.name || 'A developer'} has applied for "${job.title}".`;
          preview = message;
          userId = job.recruiter_id;
          notificationType = 'job_application';
          entityId = record.id;
          link = '?tab=my-jobs';
          emailSubject = `New Application: ${job.title}`;
          emailContent = `
            <p>You have received a new job application!</p>
            <p><strong>Developer:</strong> ${developer?.name || 'N/A'}</p>
            <p><strong>Position:</strong> ${job.title}</p>
            <p><strong>Company:</strong> ${recruiter?.company_name || 'N/A'}</p>
            <p><strong>Location:</strong> ${job.location || 'N/A'}</p>
            <p>Review the application and candidate profile in your recruiter dashboard.</p>
          `;
        }
        break;
      }
      case 'UPDATE:applied_jobs': {
        if (record.status === 'viewed') {
          const { data: job } = await supabase.from('job_roles').select('title, recruiter_id').eq('id', record.job_id).single();
          if(job) {
            const { data: recruiter } = await supabase.from('recruiters').select('company_name').eq('user_id', job.recruiter_id).single();
            title = 'Application Viewed';
            message = `Your application for "${job.title || 'a position'}" has been viewed by the recruiter.`;
            preview = message;
            userId = record.developer_id;
            notificationType = 'application_viewed';
            entityId = record.id;
            link = '?tab=jobs';
            emailSubject = `Application Viewed: ${job.title || 'Position'}`;
            emailContent = `
              <p>Great news! Your job application has been viewed.</p>
              <p><strong>Position:</strong> ${job.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${recruiter?.company_name || 'N/A'}</p>
              <p>The recruiter is reviewing your profile. Keep an eye out for further updates!</p>
            `;
          }
        } else if (record.status === 'hired') {
          const { data: job } = await supabase.from('job_roles').select('title, recruiter_id').eq('id', record.job_id).single();
           if(job) {
            const { data: recruiter } = await supabase.from('recruiters').select('company_name').eq('user_id', job.recruiter_id).single();
            title = 'Congratulations - You\'re Hired!';
            message = `Congratulations! You have been hired for "${job.title || 'a position'}".`;
            preview = message;
            userId = record.developer_id;
            notificationType = 'hired';
            entityId = record.id;
            link = '?tab=jobs';
            emailSubject = `🎉 You're Hired: ${job.title || 'Position'}`;
            emailContent = `
              <p>🎉 <strong>Congratulations!</strong> You have been hired!</p>
              <p><strong>Position:</strong> ${job.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${recruiter?.company_name || 'N/A'}</p>
              <p>Welcome to your new role! The recruiter will be in touch with next steps.</p>
            `;
          }
        }
        break;
      }
      case 'INSERT:endorsements': {
        const { data: endorsement } = await supabase.from('endorsements').select('*, endorser:users!endorser_id(name)').eq('id', record.id).single();
        if (endorsement) {
            title = 'New Endorsement Received';
            message = `You received a new endorsement from ${endorsement.endorser?.name || 'someone'}.`;
            preview = endorsement.content ? endorsement.content.substring(0, 200) + (endorsement.content.length > 200 ? '...' : '') : message;
            userId = record.developer_id;
            notificationType = 'endorsement';
            entityId = record.id;
            link = '?tab=overview';
            emailSubject = 'New Endorsement Received';
            emailContent = `
              <p>You have received a new endorsement!</p>
              <p><strong>From:</strong> ${endorsement.endorser?.name || 'Anonymous'}</p>
              ${endorsement.content ? `
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0; text-align: left;">
                  <p style="margin: 0; color: #374151; font-style: italic;">"${escapeHtml(preview)}"</p>
                </div>
              ` : ''}
              <p>View your complete endorsement profile in your dashboard.</p>
            `;
        }
        break;
      }
      case 'INSERT:recruiter_profiles': {
        if (record.status === 'pending') {
          const { data: recruiter } = await supabase.from('users').select('name').eq('id', record.user_id).single();
          if (recruiter) {
            const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
            if (admins?.length) {
              for (const admin of admins){
                await supabase.from('notifications').insert({
                  user_id: admin.id,
                  message: `${recruiter.name || 'A new recruiter'} is pending approval.`,
                  type: 'pending_recruiter',
                  entity_id: record.id,
                  link: '?tab=recruiters',
                  title: 'Recruiter Pending Approval'
                });
              }
            }
          }
        }
        break;
      }
      default:
        break;
    }

    if (!message || !userId || !notificationType) {
      return new Response(JSON.stringify({ message: 'No-op: missing required notification fields' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: targetUser } = await supabase.from('users').select('id, role, email, name').eq('id', userId).maybeSingle();

    if (!targetUser) {
        return new Response(JSON.stringify({ message: 'No-op: target user not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (notificationType === 'test_assignment' && targetUser.role === 'recruiter') {
      return new Response(JSON.stringify({ message: 'Skipped recruiter test-assignment notification' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let devPrefs = null;
    let recPrefs = null;
    try {
      const { data: d } = await supabase.from('developers').select('notification_preferences').eq('user_id', userId).maybeSingle();
      const { data: r } = await supabase.from('recruiters').select('notification_preferences').eq('user_id', userId).maybeSingle();
      devPrefs = d?.notification_preferences || {};
      recPrefs = r?.notification_preferences || {};
    } catch (e) {
      console.warn('Could not load preferences; defaulting to allow in-app/email.', e);
    }

    const combinedPrefs = { ...devPrefs, ...recPrefs };
    const allowType = isTypeAllowed(combinedPrefs, notificationType);
    const allowInApp = allowType && (typeof combinedPrefs?.in_app === 'boolean' ? combinedPrefs?.in_app : true);
    const allowEmail = allowType && (typeof combinedPrefs?.email === 'boolean' ? combinedPrefs?.email : false);

    if (allowInApp) {
      await supabase.from('notifications').insert({
        user_id: userId,
        message,
        type: notificationType,
        entity_id: entityId,
        link,
        title: title || message
      });
    }

    if (allowEmail && targetUser.email) {
      const APP_BASE_URL = Deno.env.get('APP_BASE_URL')?.replace(/\/+$/, '') || 'https://gittalent.dev';
      const routeBase = targetUser.role === 'recruiter' ? 'recruiter' : targetUser.role === 'admin' ? 'admin' : 'developer';
      const subPath = link ? link.startsWith('?') ? `/${routeBase}${link}` : link.startsWith('/') ? link : `/${link}` : `/${routeBase}`;
      const fullLink = `${APP_BASE_URL}${subPath}`;

      const subject = emailSubject || title || 'Notification';
      const text = `${message}${fullLink ? `\n\nOpen: ${fullLink}` : ''}`;

      const html = emailContent ? createStyledEmailTemplate(subject, emailContent, 'Open GitTalent', fullLink, preview) : `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;">
            <p>${message}</p>
            ${fullLink ? `<p><a href="${fullLink}" target="_blank" rel="noopener noreferrer">Open in GitTalent</a></p>` : ''}
          </div>
        `;

      await sendEmailViaResend(targetUser.email, subject, html, text);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('notify-user error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
