import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.0.0';

// --- Environment Variables ---
function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = requireEnv("RESEND_API_KEY");
const EMAIL_FROM = requireEnv("EMAIL_FROM");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://gittalent.dev";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gittalent.dev',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- Resend Helper ---
async function sendApprovalEmail(to: string, name: string) {
  const subject = "Your GitTalent account has been approved!";
  const loginUrl = `${APP_BASE_URL}/login`;

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 10px rgba(0,0,0,0.08); text-align: center;">

      <img src="https://gittalent.dev/logo.png" alt="GitTalent" style="max-width: 150px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />

      <h2 style="color: #4f46e5; margin-bottom: 16px;">Welcome to GitTalent, ${name}!</h2>

      <p style="color: #374151;">
        We're excited to let you know that your recruiter account has been approved. You can now log in to your account to start finding top developer talent.
      </p>

      <p style="margin: 24px 0;">
        <a href="${loginUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; display: inline-block;">
          Login to Your Account
        </a>
      </p>

      <p style="color: #6b7280; font-size: 14px;">
        If you have any questions, please don't hesitate to contact our support team.
      </p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        © 2025 GitTalent · <a href="https://gittalent.dev" style="color: #4f46e5; text-decoration: none;">Visit our site</a>
      </p>

    </div>
  </body>
</html>`;

  const text = `Welcome to GitTalent, ${name}! Your recruiter account has been approved. You can now log in to your account to start finding top developer talent. Login here: ${loginUrl}`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!resendResponse.ok) {
    const body = await resendResponse.text();
    throw new Error(`Resend API error ${resendResponse.status}: ${body}`);
  }
  return await resendResponse.json();
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      throw new Error("userId is required.");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Approve the user
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_approved: true })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // 2. Fetch user details to get their email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (userError) {
      // Log the error but don't fail the request, as approval was successful
      console.error(`Failed to fetch user ${userId} for email notification:`, userError.message);
    } else if (user && user.email) {
      // 3. Send the approval email
      try {
        await sendApprovalEmail(user.email, user.name || 'there');
      } catch (emailError) {
        // Log email sending failure but don't fail the whole request
        console.error(`Successfully approved user ${userId}, but failed to send notification email:`, emailError.message);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
