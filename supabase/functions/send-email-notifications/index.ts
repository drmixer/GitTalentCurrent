// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? ""; // optional shared secret

type QueueRow = {
  id: string;
  notification_id: string;
  recipient_user_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type Notification = {
  id: string;
  user_id: string;
  title: string | null;
  message: string | null;
  message_preview: string | null;
  type: string | null;
  entity_id: string | null;
  link: string | null;
  created_at: string;
};

type User = {
  id: string;
  email: string | null;
  name: string | null;
  role: "developer" | "recruiter" | "admin" | string;
};

function okAuth(req: Request): boolean {
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

function buildLink(user: User, notif: Notification): string {
  // notif.link is stored like "?tab=tests", etc.
  // Adjust role base if your app uses different routes.
  const roleBase = user.role === "recruiter"
    ? "/recruiter"
    : user.role === "developer"
    ? "/developer"
    : "/dashboard";
  const suffix = notif.link || "";
  if (/^https?:\/\//i.test(suffix)) return suffix;
  if (suffix.startsWith("/")) return `${APP_BASE_URL}${suffix}`;
  if (suffix.startsWith("?")) return `${APP_BASE_URL}${roleBase}${suffix}`;
  return `${APP_BASE_URL}${roleBase}${suffix ? `/${suffix}` : ""}`;
}

function buildEmailContent(user: User, notif: Notification) {
  const type = (notif.type || "").toLowerCase();
  const subject =
    notif.title ||
    (type === "message"
      ? "You have a new message"
      : type === "test_assignment"
      ? "New coding test assigned"
      : "New activity on GitTalent");

  const preview = notif.message_preview || notif.message || "";
  const linkUrl = buildLink(user, notif);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <h2 style="margin:0 0 12px;">${escapeHtml(subject)}</h2>
      ${
        preview
          ? `<p style="margin:0 0 16px; color:#333;">${escapeHtml(preview)}</p>`
          : ``
      }
      <p style="margin:0 0 20px; color:#333;">
        Click the button below to view in GitTalent.
      </p>
      <p>
        <a href="${linkUrl}" style="display:inline-block; background:#111827; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px;">
          Open GitTalent
        </a>
      </p>
      <p style="margin-top:28px; font-size:12px; color:#666;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${linkUrl}" style="color:#2563EB;">${linkUrl}</a>
      </p>
    </div>
  `;

  const text = [
    subject,
    preview ? `\n${preview}` : "",
    `\nOpen GitTalent: ${linkUrl}`,
  ].join("");

  return { subject, html, text };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const resp = await fetch("https://api.resend.com/emails", {
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

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend API error ${resp.status}: ${body}`);
  }
  return await resp.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!okAuth(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Process a batch of pending items
    const limit = Number(new URL(req.url).searchParams.get("limit")) || 25;

    const { data: queue, error: qErr } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (qErr) throw qErr;

    const results: Array<{
      id: string;
      status: "sent" | "failed" | "skipped";
      error?: string;
    }> = [];

    for (const row of (queue as QueueRow[]) ?? []) {
      try {
        // Fetch related notification and user
        const [{ data: notif, error: nErr }, { data: user, error: uErr }] =
          await Promise.all([
            supabase
              .from("notifications")
              .select("*")
              .eq("id", row.notification_id)
              .single(),
            supabase
              .from("users")
              .select("id, email, name, role")
              .eq("id", row.recipient_user_id)
              .single(),
          ]);

        if (nErr) throw nErr;
        if (uErr) throw uErr;

        const recipient = user as User;
        const notification = notif as Notification;

        if (!recipient?.email) {
          // No email on file; mark failed and continue
          await supabase
            .from("email_queue")
            .update({
              status: "failed",
              attempts: row.attempts + 1,
              last_error: "Recipient has no email address",
            })
            .eq("id", row.id);
          results.push({
            id: row.id,
            status: "failed",
            error: "Recipient has no email",
          });
          continue;
        }

        // Compose and send email
        const { subject, html, text } = buildEmailContent(recipient, notification);
        await sendViaResend(recipient.email, subject, html, text);

        // Mark as sent
        await supabase
          .from("email_queue")
          .update({ status: "sent", last_error: null })
          .eq("id", row.id);

        results.push({ id: row.id, status: "sent" });
      } catch (err: any) {
        // Increment attempts and store error
        await supabase
          .from("email_queue")
          .update({
            attempts: row.attempts + 1,
            last_error: err?.message?.toString?.() ?? String(err),
            // Keep status as 'pending' for retry until attempts >= 5
            status: row.attempts + 1 >= 5 ? "failed" : "pending",
          })
          .eq("id", row.id);

        results.push({
          id: row.id,
          status: row.attempts + 1 >= 5 ? "failed" : "skipped",
          error: err?.message ?? String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
