# notify-user function

Delivers in-app and email notifications for key events:
- Test assignments and completion
- Messages
- Job applications and status changes
- Endorsements (developer gets notified)

## Required environment variables (secrets)

Set these in your Supabase project for Edge Functions:

- RESEND_API_KEY: Your Resend API key (required for email delivery)
- EMAIL_FROM: From address used by Resend (e.g., "GitTalent <noreply@example.com>")
- APP_BASE_URL: Your app base URL (e.g., https://app.yourdomain.com)

Also required for Supabase Admin client:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Example (using Supabase CLI):
```
supabase secrets set RESEND_API_KEY=your_resend_key
supabase secrets set EMAIL_FROM="GitTalent <noreply@gittalent.dev>"
supabase secrets set APP_BASE_URL=https://app.gittalent.dev
supabase secrets set SUPABASE_URL=https://YOUR-REF.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

## Event sources

This function expects to be invoked with JSON payloads describing DB events. Ensure your database webhooks or Postgres triggers call this function for:

- INSERT on assignments (developer test assignment)
- UPDATE on assignments (status completed -> recruiter test completion)
- INSERT/UPDATE on test_assignments (if you use this table variant)
- INSERT on messages
- INSERT on applied_jobs and UPDATE on applied_jobs (status changes)
- INSERT on endorsements (to notify the developer)

If you use Supabase Database Webhooks:
- Create a webhook per table event targeting:
  https://YOUR-REF.functions.supabase.co/notify-user
- Method: POST
- Body: “Record payload”
- Include authorization headers as needed (optional)

If you prefer Postgres HTTP triggers, ensure the `http` extension is enabled and post to the same URL with a JSON body compatible with this function.

## Preferences

- The function reads notification_preferences from both developers and recruiters and:
  - Respects per-type flags (if set) via `types.{type}`
  - Respects `in_app` for in-app delivery
  - Respects `email` for email delivery
- Test assignment notifications are skipped for recruiters by design.
