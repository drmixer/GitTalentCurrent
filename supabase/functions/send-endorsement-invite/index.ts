// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// CORS must match your frontend domain
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gittalent.dev',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
};
function requireEnv(name) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
const RESEND_API_KEY = requireEnv('RESEND_API_KEY');
const EMAIL_FROM = requireEnv('EMAIL_FROM');
// Keep the same URL format as your generate-endorsement-link function
const PUBLIC_BASE_URL = Deno.env.get('PUBLIC_GITTALENT_BASE_URL') || 'https://gittalent.dev';
function escapeHtml(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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
async function sendViaResend(to, subject, html, text) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
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
    throw new Error(`Resend error ${resp.status}: ${body}`);
  }
  return await resp.json();
}
serve(async (req)=>{
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { recipientEmail, developerId, developerName, message } = await req.json();
    if (!recipientEmail || !developerId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'recipientEmail and developerId are required.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const safeDevName = developerName?.trim() || 'a developer';
    const link = `${PUBLIC_BASE_URL}/u/${developerId}/endorse`;
    const subject = `${safeDevName} invited you to endorse them on GitTalent`;
    const preview = message?.trim() ? message.trim() : `Please share a short endorsement for ${safeDevName}.`;
    const content = `
      <p><strong>${escapeHtml(safeDevName)}</strong> has invited you to write an endorsement for them on GitTalent.</p>
      ${message?.trim() ? `
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0; text-align: left;">
          <p style="margin: 0; color: #374151; font-style: italic;">"${escapeHtml(message.trim())}"</p>
        </div>
      ` : ''}
      <p>Your endorsement will help ${escapeHtml(safeDevName)} showcase their professional skills and work quality to potential employers.</p>
      <p>Click the button below to write your endorsement. It only takes a minute!</p>
    `;
    const html = createStyledEmailTemplate(`Endorse ${safeDevName}`, content, 'Write Endorsement', link, preview);
    const text = [
      `Endorse ${safeDevName}`,
      preview ? `\n${preview}` : '',
      `\nWrite Endorsement: ${link}`
    ].join('');
    await sendViaResend(recipientEmail, subject, html, text);
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('[send-endorsement-invite] error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error?.message ?? 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
