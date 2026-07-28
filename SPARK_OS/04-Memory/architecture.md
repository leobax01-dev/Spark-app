# Application Architecture & Environment

Owned by: **Dev Agent**

## Stack

- **Frontend Engine:** React 18 + Vite 4
- **Styling:** Tailwind CSS
- **Backend & Database:** Supabase (Auth, Postgres, Realtime)
- **Payments:** Stripe
- **Analytics:** PostHog
- **Push Notifications:** web-push
- **Media Processing:** ffmpeg (`@ffmpeg-installer/ffmpeg`)
- **Deployment:** Vercel

## Config Files

- `vite.config.js` — build config
- `vercel.json` — deployment/routing config
- `package.json` — dependencies & scripts
- `.env.local` — local environment secrets (never committed, never logged to markdown)

## Primary Directories

- `/src` — core UI components & React application logic
- `/api` — serverless functions / API endpoints
- `/public` — static assets
- `SPARK_OS/` — agent orchestration system

## Conventions

- Prefer editing existing components over introducing new abstractions.
- No premature optimization or speculative feature flags.
- Keep serverless functions in `/api` thin — push business logic into shared modules where reused.
- Any schema change or migration is logged here after it ships.

## RLS Audit — 2026-07-27 (CTO Agent)

**Trigger:** Launch Day directive ([`02-Tasks/Pending/gtm-launch-day-1.md`](../02-Tasks/Pending/gtm-launch-day-1.md)) — audit multi-tenant isolation by `brokerage_id` ahead of Founding Member / white-label launch.

**Method:** static audit of this repo (`/src`, `/api`) — no local Supabase migrations directory exists (`supabase/` only contains CLI link metadata in `.temp/`, no `migrations/` folder), and this environment has no direct DB/SQL access to the live project. Findings below are code-level, not a live `pg_policies` query — a live-database policy dump is a required follow-up before any brokerage deal goes to production.

**Findings:**

1. **No `brokerage_id` or `team_id` column referenced anywhere in the codebase.** Grepped `/src` and `/api` for `brokerage_id`, `team_id`, `RLS`, `row level security`, `create policy` — zero matches for either identifier. SPARK today is architected as **single-tenant-per-user**, not multi-tenant-per-brokerage.
2. **Primary tenancy key in use is `user_email`**, not a brokerage/team foreign key. Tables observed via `.from(...)` calls: `users`, `agent_data_sync`, `autopilot_runs`, `autopilot_memory`.
3. **Two server-side endpoints explicitly bypass RLS via the service role** (by design, for server-trusted writes): [`api/deduct-credits.js`](../../api/deduct-credits.js) and [`api/update-plan.js`](../../api/update-plan.js). These are appropriate uses of the service role *if* every query inside them is manually scoped to the authenticated user — that scoping was not verified in this pass and needs a follow-up read of both files line-by-line.
4. **No visibility into actual Postgres RLS policies** from this environment — cannot confirm whether `users`/`agent_data_sync`/`autopilot_runs`/`autopilot_memory` currently have RLS enabled at all at the database level. This must be checked directly in the Supabase dashboard or via `supabase db pull` before launch.

**Conclusion: brokerage-level multi-tenant isolation does not exist yet.** This blocks any white-label brokerage deal (CRO_Agent's pipeline) — it does **not** block the Founding Member solo-agent launch, since solo seats are already isolated by `user_email`/user auth, which is the existing tenancy boundary.

**Recommended remediation (requires `02-Tasks/Needs_Approval/` sign-off before implementation, per schema-change policy):**
- Add `brokerage_id` (and optionally `team_id`) columns to tenant-scoped tables.
- Write and test RLS policies scoping all reads/writes to the requesting session's `brokerage_id`.
- Pull and document live RLS policy state via `supabase db pull` / dashboard before any brokerage pilot.
- Line-by-line review of `deduct-credits.js` and `update-plan.js` to confirm service-role queries are manually user-scoped.

## Change Log

```
### 2026-07-27 — RLS/multi-tenancy audit (CTO Agent, launch day)
- Audited codebase for brokerage_id/team_id and RLS usage ahead of Founding Member + white-label launch.
- Finding: no multi-tenant-by-brokerage structure exists; current tenancy key is user_email.
- Blocks white-label brokerage sales until remediated; does not block solo Founding Member launch.
```