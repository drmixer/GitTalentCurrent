// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// CORS must match your frontend domain
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gittalent.dev',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const RESEND_API_KEY = requireEnv('RESEND_API_KEY');
const EMAIL_FROM = requireEnv('EMAIL_FROM');
// Keep the same URL format as your generate-endorsement-link function
const PUBLIC_BASE_URL = Deno.env.get('PUBLIC_GITTALENT_BASE_URL') || 'https://gittalent.dev';

function escapeHtml(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend error ${resp.status}: ${body}`);
  }
  return await resp.json();
}

serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recipientEmail, developerId, developerName, message } = await req.json();

    if (!recipientEmail || !developerId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'recipientEmail and developerId are required.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const safeDevName = (developerName?.trim() || 'a developer');
    const link = `${PUBLIC_BASE_URL}/u/${developerId}/endorse`;

    const subject = `${safeDevName} invited you to endorse them on GitTalent`;
    const preview = message?.trim()
      ? message.trim()
      : `Please share a short endorsement for ${safeDevName}.`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        <h2 style="margin:0 0 12px;">Endorse ${escapeHtml(safeDevName)}</h2>
        <p style="margin:0 0 16px; color:#333;">${escapeHtml(preview)}</p>
        <p style="margin:0 0 20px; color:#333;">
          Click the button below to write your endorsement on GitTalent.
        </p>
        <p>
          <a href="${link}" style="display:inline-block; background:#111827; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px;">
            Write Endorsement
          </a>
        </p>
        <p style="margin-top:28px; font-size:12px; color:#666;">
          If the button doesn't work, copy and paste this link:<br/>
          <a href="${link}" style="color:#2563EB;">${link}</a>
        </p>
      </div>
    `;

    const text = [
      `Endorse ${safeDevName}`,
      preview ? `\n${preview}` : '',
      `\nWrite Endorsement: ${link}`,
    ].join('');

    await sendViaResend(recipientEmail, subject, html, text);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[send-endorsement-invite] error:', error);
    return new Response(JSON.stringify({ success: false, message: error?.message ?? 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
