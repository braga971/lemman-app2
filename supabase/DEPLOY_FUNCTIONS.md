Deploy Supabase Edge Functions

Prerequisites
- Install CLI: `npm i -g supabase`
- Login: `supabase login`
- Project ref: find in your dashboard URL, e.g. `abcd1234`

Project-level secrets (recommended)
- Set once for all functions:
  - `supabase secrets set --project-ref <PROJECT_REF> SUPABASE_URL="https://<ref>.supabase.co"`
  - `supabase secrets set --project-ref <PROJECT_REF> SUPABASE_ANON_KEY="<anon key>"`
  - `supabase secrets set --project-ref <PROJECT_REF> SUPABASE_SERVICE_ROLE_KEY="<service role key>"`
  - For `fix-auth-rls` also set: `supabase secrets set --project-ref <PROJECT_REF> SUPABASE_DB_URL="postgres://..."`

Functions and required env
- create-user: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- delete-user: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- reset-password: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- fix-auth-rls: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
- get-signed-url: (placeholder; add required vars if implemented)
- upload-activity-photo: (placeholder)
- delete-activity-photo: (placeholder)

Deploy commands
- Run from repo root (each function directory exists under `supabase/functions`):
  - `supabase functions deploy create-user --project-ref <PROJECT_REF>`
  - `supabase functions deploy delete-user --project-ref <PROJECT_REF>`
  - `supabase functions deploy reset-password --project-ref <PROJECT_REF>`
  - `supabase functions deploy fix-auth-rls --project-ref <PROJECT_REF>`
  - (optional) `supabase functions deploy get-signed-url --project-ref <PROJECT_REF>`
  - (optional) `supabase functions deploy upload-activity-photo --project-ref <PROJECT_REF>`
  - (optional) `supabase functions deploy delete-activity-photo --project-ref <PROJECT_REF>`

Notes
- `create-user`, `delete-user`, `reset-password` expect a valid Authorization Bearer token from the client and allow only `manager` users (checked via `public.profiles.role`).
- `fix-auth-rls` should be called with a Service Role token (or matching `SUPABASE_SERVICE_ROLE_KEY`) and runs DB-side changes to auth RLS.
- If you prefer per-function secrets instead of project-level ones:
  - Example: `supabase functions secrets set --project-ref <PROJECT_REF> --name create-user SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...`

