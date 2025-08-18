import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type Prefs = {
  in_app?: boolean;
  email?: boolean;
  types?: Record<string, boolean>;
};

function isTypeAllowed(prefs: Prefs | null | undefined, type: string) {
  // If specific type flag exists and is false, block; otherwise allow by default
  if (prefs?.types && Object.prototype.hasOwnProperty.call(prefs.types, type)) {
    return !!prefs.types[type];
  }
  return true;
}

async function sendEmailViaResend(to: string, subject: string, html: string, text: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'GitTalent <noreply@gittalent.dev>';

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set; skipping email send.');
    return { skipped: true, reason: 'missing_api_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      text
    })
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    console.error('Resend API error:', res.status, errTxt);
    throw new Error(`Resend API returned ${res.status}`);
  }

  return await res.json().catch(() => ({}));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    let record: any = null;
    let table: string | undefined;

    // Support multiple trigger formats
    if (requestBody.table && requestBody.operation) {
      type = requestBody.operation;
      record = requestBody.record;
      table = requestBody.table;
    } else if (requestBody.type && requestBody.record) {
      // Expect type like 'INSERT' and record.table in some setups
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
    switch (`${type}:${table || record.table || ''}`) {
      case 'INSERT:assignments':
        title = 'New Coding Test Assigned';
        message = 'You have been assigned a new coding test.';
        userId = record.developer_id;
        notificationType = 'test_assignment';
        link = '?tab=tests';
        break;

      case 'UPDATE:assignments':
        if (record.status === 'completed') {
          const { data: assignment, error: assignmentError } = await supabase
            .from('assignments')
            .select(`*, job_role:job_roles(recruiter_id, title)`)
            .eq('id', record.id)
            .single();
          if (assignmentError) break;
          if (assignment?.job_role?.recruiter_id) {
            title = 'Test Completed';
            message = `A developer has completed a coding test you assigned for "${assignment.job_role.title}".`;
            userId = assignment.job_role.recruiter_id;
            notificationType = 'test_completion';
            entityId = record.id;
            link = '?tab=tracker';
          }
        }
        break;

      case 'INSERT:test_assignments':
        title = 'New Coding Test Assigned';
        message = 'You have been assigned a new coding test.';
        userId = record.developer_id;
        notificationType = 'test_assignment';
        link = '?tab=tests';
        break;

      case 'UPDATE:test_assignments':
        if (record.status === 'Completed') {
          const { data: jobRole, error: jobError } = await supabase
            .from('job_roles')
            .select('recruiter_id, title')
            .eq('id', record.job_role_id)
            .single();
          if (jobError) break;
          if (jobRole?.recruiter_id) {
            title = 'Test Completed';
            message = 'A developer has completed a coding test you assigned.';
            userId = jobRole.recruiter_id;
            notificationType = 'test_completion';
            entityId = record.id;
            link = '?tab=tracker';
          }
        }
        break;

      case 'INSERT:messages':
        title = 'New Message';
        message = 'You have a new message.';
        userId = record.receiver_id;
        notificationType = 'message';
        link = '?tab=messages';
        entityId = record.sender_id;

        // Also notify admins (existing behavior)
        {
          const { data: admins } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('role', 'admin');
          if (admins && admins.length > 0) {
            for (const admin of admins) {
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

      case 'INSERT:applied_jobs': {
        const { data: job } = await supabase
          .from('job_roles')
          .select('recruiter_id')
          .eq('id', record.job_id)
          .single();
        if (!job) break;
        title = 'New Job Application';
        message = 'A developer has applied for one of your jobs.';
        userId = job.recruiter_id;
        notificationType = 'job_application';
        link = '?tab=my-jobs';
        break;
      }

      case 'UPDATE:applied_jobs':
        if (record.status === 'viewed') {
          title = 'Application Viewed';
          message = 'Your application for a job has been viewed.';
          userId = record.developer_id;
          notificationType = 'application_viewed';
          link = '?tab=jobs';
        } else if (record.status === 'hired') {
          title = `You've been hired!`;
          message = 'Congratulations! You have been hired for a position.';
          userId = record.developer_id;
          notificationType = 'hired';
          link = '?tab=jobs';
        }
        break;

      // New: Endorsements -> notify developer
      case 'INSERT:endorsements':
        title = 'New Endorsement';
        message = 'You received a new endorsement.';
        userId = record.developer_id;
        notificationType = 'endorsement';
        link = '?tab=overview';
        break;

      // Legacy compatibility
      case 'INSERT:recruiter_profiles':
        if (record.status === 'pending') {
          const { data: admins, error } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('role', 'admin');
          if (!error && admins?.length) {
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
        // ignore
        break;
    }

    // Skip test-assignment notifications aimed at recruiters
    if (message && userId && notificationType === 'test_assignment') {
      const { data: targetUser } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();
      if (targetUser?.role === 'recruiter') {
        return new Response(JSON.stringify({ message: 'Skipped recruiter test-assignment notification' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Deliver channels according to preferences
    if (message && userId && notificationType) {
      // Load preferences for both roles and merge channel flags
      let devPrefs: Prefs | null = null;
      let recPrefs: Prefs | null = null;

      try {
        const [{ data: d }, { data: r }] = await Promise.all([
          supabase.from('developers').select('notification_preferences').eq('user_id', userId).maybeSingle(),
          supabase.from('recruiters').select('notification_preferences').eq('user_id', userId).maybeSingle()
        ]);
        devPrefs = (d?.notification_preferences as any) || null;
        recPrefs = (r?.notification_preferences as any) || null;
      } catch (e) {
        console.warn('Could not load preferences; defaulting to allow in-app/email.', e);
      }

      const allowInApp =
        (typeof devPrefs?.in_app === 'boolean' ? devPrefs?.in_app : true) &&
        (typeof recPrefs?.in_app === 'boolean' ? recPrefs?.in_app : true) &&
        isTypeAllowed(devPrefs, notificationType) &&
        isTypeAllowed(recPrefs, notificationType);

      const allowEmail =
        (typeof devPrefs?.email === 'boolean' ? devPrefs?.email : false) ||
        (typeof recPrefs?.email === 'boolean' ? recPrefs?.email : false);

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
        console.log('In-app suppressed by user preference', { userId, notificationType });
      }

      // Send email if allowed
      if (allowEmail && isTypeAllowed(devPrefs, notificationType) && isTypeAllowed(recPrefs, notificationType)) {
        const { data: targetUser } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', userId)
          .maybeSingle();

        const to = targetUser?.email;
        if (to) {
          const appUrl =
            Deno.env.get('PUBLIC_APP_URL') ||
            Deno.env.get('NEXT_PUBLIC_SITE_URL') ||
            Deno.env.get('SITE_URL') ||
            '';

          const fullLink = appUrl
            ? `${appUrl.replace(/\/+$/, '')}/${link.replace(/^\?/, '') ? `developer${link}` : ''}` // heuristic: default to developer tab paths
            : '';

          const emailSubject = title || 'Notification';
          const emailText = `${message}${fullLink ? `\n\nOpen: ${fullLink}` : ''}`;
          const emailHtml = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;">
              <p>${message}</p>
              ${fullLink ? `<p><a href="${fullLink}" target="_blank" rel="noopener noreferrer">Open in GitTalent</a></p>` : ''}
            </div>
          `;

          try {
            await sendEmailViaResend(to, emailSubject, emailHtml, emailText);
            console.log('Notification email sent via Resend to', to, 'type:', notificationType);
          } catch (e) {
            console.error('Failed to send notification email via Resend:', e);
          }
        } else {
          console.log('No email on file for user; skipping email notification', { userId });
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ message: 'No-op' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('notify-user error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
