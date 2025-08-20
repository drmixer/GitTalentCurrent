// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function requireEnv(name) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = requireEnv("RESEND_API_KEY");
const EMAIL_FROM = requireEnv("EMAIL_FROM");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://gittalent.dev";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? ""; // optional shared secret
function okAuth(req) {
  // Allow if:
  // - CRON_SECRET matches (Authorization: Bearer <CRON_SECRET>), or
  // - No secret provided (run inside Supabase scheduled env or manually with service-role)
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (CRON_SECRET && token === CRON_SECRET) return true;
  // If no CRON_SECRET set, accept the request (edge schedules send no auth).
  if (!CRON_SECRET) return true;
  return false;
}
function buildLink(user, notif) {
  // notif.link is stored like "?tab=tests", etc.
  // Adjust role base if your app uses different routes.
  const roleBase = user.role === "recruiter" ? "/recruiter" : user.role === "developer" ? "/developer" : "/dashboard";
  const suffix = notif.link || "";
  if (/^https?:\/\//i.test(suffix)) return suffix;
  if (suffix.startsWith("/")) return `${APP_BASE_URL}${suffix}`;
  if (suffix.startsWith("?")) return `${APP_BASE_URL}${roleBase}${suffix}`;
  return `${APP_BASE_URL}${roleBase}${suffix ? `/${suffix}` : ""}`;
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
async function getEnhancedEmailContent(supabase, user, notif, linkUrl) {
  const type = (notif.type || "").toLowerCase();
  let subject = notif.title || "New activity on GitTalent";
  let content = notif.message || "You have new activity on GitTalent.";
  let preview = notif.message_preview || "";
  // Enhance content based on notification type
  try {
    switch(type){
      case 'message':
        if (notif.entity_id) {
          // entity_id contains sender_id for messages
          const { data: sender } = await supabase.from('users').select('name').eq('id', notif.entity_id).single();
          // Try to get the actual message content
          const { data: messages } = await supabase.from('messages').select('content, subject').eq('sender_id', notif.entity_id).eq('receiver_id', user.id).order('created_at', {
            ascending: false
          }).limit(1);
          const message = messages?.[0];
          const senderName = sender?.name || 'a user';
          subject = message?.subject || `New message from ${senderName}`;
          preview = message?.content ? message.content.length > 150 ? message.content.substring(0, 150) + '...' : message.content : '';
          content = `
            <p>You have received a new message from <strong>${escapeHtml(senderName)}</strong>.</p>
            ${message?.content ? `
              <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0; text-align: left;">
                <p style="margin: 0; color: #374151; font-style: italic;">"${escapeHtml(preview)}"</p>
              </div>
            ` : ''}
            <p>Click below to read the full message and reply.</p>
          `;
        }
        break;
      case 'test_assignment':
        // Get assignment details
        if (notif.entity_id) {
          const { data: assignment } = await supabase.from('assignments').select(`
              *,
              job_role:job_roles(title, company),
              recruiter:users!job_roles(name)
            `).eq('developer_id', user.id).order('created_at', {
            ascending: false
          }).limit(1).single();
          if (assignment) {
            subject = `New Coding Test: ${assignment.job_role?.title || 'Position'}`;
            content = `
              <p>You have been assigned a new coding test!</p>
              <p><strong>Position:</strong> ${assignment.job_role?.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${assignment.job_role?.company || 'N/A'}</p>
              <p><strong>From:</strong> ${assignment.recruiter?.name || 'Recruiter'}</p>
              <p>Complete your test to proceed with the application process.</p>
            `;
          }
        }
        break;
      case 'test_completion':
        // Get completed test details
        if (notif.entity_id) {
          const { data: assignment } = await supabase.from('assignments').select(`
              *,
              job_role:job_roles(title, company),
              developer:users(name)
            `).eq('id', notif.entity_id).single();
          if (assignment) {
            subject = `Test Completed: ${assignment.job_role?.title || 'Position'}`;
            content = `
              <p>Great news! A developer has completed the coding test you assigned.</p>
              <p><strong>Developer:</strong> ${assignment.developer?.name || 'N/A'}</p>
              <p><strong>Position:</strong> ${assignment.job_role?.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${assignment.job_role?.company || 'N/A'}</p>
              <p>Review their submission and next steps in your recruiter dashboard.</p>
            `;
          }
        }
        break;
      case 'job_application':
        // Get application details
        const { data: applications } = await supabase.from('applied_jobs').select(`
            *,
            job_role:job_roles(title, company, location),
            developer:users(name)
          `).eq('job_id', notif.entity_id).order('created_at', {
          ascending: false
        }).limit(1);
        const application = applications?.[0];
        if (application) {
          subject = `New Application: ${application.job_role?.title || 'Position'}`;
          content = `
            <p>You have received a new job application!</p>
            <p><strong>Developer:</strong> ${application.developer?.name || 'N/A'}</p>
            <p><strong>Position:</strong> ${application.job_role?.title || 'N/A'}</p>
            <p><strong>Company:</strong> ${application.job_role?.company || 'N/A'}</p>
            <p><strong>Location:</strong> ${application.job_role?.location || 'N/A'}</p>
            <p>Review the application and candidate profile in your recruiter dashboard.</p>
          `;
        }
        break;
      case 'endorsement':
        // Get endorsement details
        if (notif.entity_id) {
          const { data: endorsement } = await supabase.from('endorsements').select(`
              *,
              endorser:users!endorser_id(name)
            `).eq('developer_id', user.id).order('created_at', {
            ascending: false
          }).limit(1).single();
          if (endorsement) {
            subject = 'New Endorsement Received';
            content = `
              <p>You have received a new endorsement!</p>
              <p><strong>From:</strong> ${endorsement.endorser?.name || 'Anonymous'}</p>
              ${endorsement.content ? `
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0; text-align: left;">
                  <p style="margin: 0; color: #374151; font-style: italic;">"${escapeHtml(endorsement.content.substring(0, 200))}${endorsement.content.length > 200 ? '...' : ''}"</p>
                </div>
              ` : ''}
              <p>View your complete endorsement profile in your dashboard.</p>
            `;
          }
        }
        break;
      case 'application_viewed':
        // Get application details
        if (notif.entity_id) {
          const { data: application } = await supabase.from('applied_jobs').select(`
              *,
              job_role:job_roles(title, company)
            `).eq('id', notif.entity_id).single();
          if (application) {
            subject = `Application Viewed: ${application.job_role?.title || 'Position'}`;
            content = `
              <p>Great news! Your job application has been viewed.</p>
              <p><strong>Position:</strong> ${application.job_role?.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${application.job_role?.company || 'N/A'}</p>
              <p>The recruiter is reviewing your profile. Keep an eye out for further updates!</p>
            `;
          }
        }
        break;
      case 'hired':
        // Get application details
        if (notif.entity_id) {
          const { data: application } = await supabase.from('applied_jobs').select(`
              *,
              job_role:job_roles(title, company)
            `).eq('id', notif.entity_id).single();
          if (application) {
            subject = `🎉 You're Hired: ${application.job_role?.title || 'Position'}`;
            content = `
              <p>🎉 <strong>Congratulations!</strong> You have been hired!</p>
              <p><strong>Position:</strong> ${application.job_role?.title || 'N/A'}</p>
              <p><strong>Company:</strong> ${application.job_role?.company || 'N/A'}</p>
              <p>Welcome to your new role! The recruiter will be in touch with next steps.</p>
            `;
          }
        }
        break;
    }
  } catch (error) {
    console.warn('Error enhancing email content:', error);
  }
  return {
    subject,
    content,
    preview
  };
}
function escapeHtml(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
async function sendViaResend(to, subject, html, text) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
      text
    })
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend API error ${resp.status}: ${body}`);
  }
  return await resp.json();
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    if (!okAuth(req)) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Process a batch of pending items
    const limit = Number(new URL(req.url).searchParams.get("limit")) || 25;
    const { data: queue, error: qErr } = await supabase.from("email_queue").select("*").eq("status", "pending").lt("attempts", 5).order("created_at", {
      ascending: true
    }).limit(limit);
    if (qErr) throw qErr;
    const results = [];
    for (const row of queue ?? []){
      try {
        // Fetch related notification and user
        const [{ data: notif, error: nErr }, { data: user, error: uErr }] = await Promise.all([
          supabase.from("notifications").select("*").eq("id", row.notification_id).single(),
          supabase.from("users").select("id, email, name, role").eq("id", row.recipient_user_id).single()
        ]);
        if (nErr) throw nErr;
        if (uErr) throw uErr;
        const recipient = user;
        const notification = notif;
        if (!recipient?.email) {
          // No email on file; mark failed and continue
          await supabase.from("email_queue").update({
            status: "failed",
            attempts: row.attempts + 1,
            last_error: "Recipient has no email address"
          }).eq("id", row.id);
          results.push({
            id: row.id,
            status: "failed",
            error: "Recipient has no email"
          });
          continue;
        }
        // Get enhanced email content with context
        const linkUrl = buildLink(recipient, notification);
        const { subject, content, preview } = await getEnhancedEmailContent(supabase, recipient, notification, linkUrl);
        // Use styled template
        const html = createStyledEmailTemplate(subject, content, 'Open GitTalent', linkUrl, preview);
        const text = [
          subject,
          preview ? `\n${preview}` : "",
          `\nOpen GitTalent: ${linkUrl}`
        ].join("");
        await sendViaResend(recipient.email, subject, html, text);
        // Mark as sent
        await supabase.from("email_queue").update({
          status: "sent",
          last_error: null
        }).eq("id", row.id);
        results.push({
          id: row.id,
          status: "sent"
        });
      } catch (err) {
        // Increment attempts and store error
        await supabase.from("email_queue").update({
          attempts: row.attempts + 1,
          last_error: err?.message?.toString?.() ?? String(err),
          // Keep status as 'pending' for retry until attempts >= 5
          status: row.attempts + 1 >= 5 ? "failed" : "pending"
        }).eq("id", row.id);
        results.push({
          id: row.id,
          status: row.attempts + 1 >= 5 ? "failed" : "skipped",
          error: err?.message ?? String(err)
        });
      }
    }
    return new Response(JSON.stringify({
      processed: results.length,
      results
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err?.message ?? String(err)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
function escapeHtml(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
