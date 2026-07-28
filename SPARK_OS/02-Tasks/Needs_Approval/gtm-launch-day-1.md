# GTM Launch Day — Directive

**Date:** 2026-07-27
**Priority:** High
**Status:** Pending

## Context

This is the executive C-Suite's first coordinated launch directive. Four sub-tasks span CMO, CTO, CFO, and CEO — each executive agent owns its piece and reports completion back through this file / the daily briefing.

---

## 1. CMO_Agent — Founding Member Announcement Copy

**Owner:** CMO_Agent

Draft announcement copy welcoming the first 20 Founding Members to SPARK. Copy should:
- Reflect positioning from `00-System/CONTEXT.md` (AI Operating System for real estate agents, Autopilot as the wedge).
- Speak directly to the Founding Member cohort — early access, white-glove onboarding, direct product input.
- Include a clear CTA (activate account / book onboarding call).
- Be drafted in multiple formats: email, and a short social/LinkedIn version.

**Output:** draft copy delivered for review. **External send requires approval** — file to `02-Tasks/Needs_Approval/` before anything goes out.

---

## 2. CTO_Agent — Supabase RLS Audit

**Owner:** CTO_Agent

Audit all Supabase Row-Level Security policies for multi-tenant data isolation by `brokerage_id`. Specifically:
- Enumerate every table containing client, deal, or brokerage-scoped data.
- Confirm each has an RLS policy scoping reads/writes to the requesting user's `brokerage_id` (and `team_id` where applicable).
- Flag any table missing RLS entirely, or with an overly permissive policy.
- Document findings in `04-Memory/Architecture.md` under a new "RLS Audit" entry.

**Output:** audit findings + remediation list. Any policy change goes to `02-Tasks/Needs_Approval/` before applying to production.

---

## 3. CFO_Agent — Initialize Financial Metrics Tracking

**Owner:** CFO_Agent

Create and initialize `04-Memory/Financial_Metrics.md` to track ARR progress toward the $4.02M Conservative / $35.2M Ambitious exit targets. Should include:
- Current MRR/ARR baseline (starting at $0 pre-launch).
- Solo seat economics ($99–$129/mo) and white-label brokerage economics ($2.5k–$4k/mo) modeled separately.
- A tracked path/milestone table toward the Conservative target.
- Founding Member cohort (20 members) modeled as initial revenue base.

**Output:** `04-Memory/Financial_Metrics.md` created and populated.

---

## 4. CEO_Agent — Launch Readiness Summary

**Owner:** CEO_Agent

Once CMO, CTO, and CFO sub-tasks above are complete (or have reported status), log a launch readiness summary in `05-Daily-Briefings/2026-07-27.md` covering:
- Founding Member announcement status (drafted / pending approval / sent).
- RLS audit outcome (clean / remediation needed, and what's outstanding).
- Financial tracking baseline (confirm `Financial_Metrics.md` is live).
- Overall go/no-go recommendation for Founding Member launch.

**Output:** entry appended to today's daily briefing summarizing cross-functional launch readiness.
