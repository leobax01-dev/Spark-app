# SPARK_OS Agent Orchestration Rules

SPARK_OS is run by four specialized agents coordinated by a single Orchestrator. This file defines how they interact, hand off work, and stay within their lanes.

## The Four Agents

| Agent | Domain | Profile |
|---|---|---|
| **Orchestrator** | Chief of Staff — routing, prioritization, daily briefings | [Orchestrator.md](../03-Agents/Orchestrator.md) |
| **Dev Agent** | Engineering, code execution, deploys | [Dev_Agent.md](../03-Agents/Dev_Agent.md) |
| **Growth Agent** | GTM, sales, agent acquisition | [Growth_Agent.md](../03-Agents/Growth_Agent.md) |
| **Ops Agent** | Metrics, support, Vercel/Supabase operations | [Ops_Agent.md](../03-Agents/Ops_Agent.md) |

## Core Orchestration Rules

1. **Single entry point.** All incoming work (ideas, bug reports, leads, feature requests) lands in `01-Inbox/` first. The Orchestrator triages it and routes it to the correct agent's task queue.
2. **Task lifecycle.** Every task moves through `02-Tasks/Pending/` → (optionally) `02-Tasks/Needs_Approval/` → `02-Tasks/Completed/`. No agent deletes a task file; it moves it.
3. **One owner per task.** Each task file has exactly one assigned agent. If a task spans domains (e.g., a pricing change touching Dev + Growth), the Orchestrator splits it into sub-tasks with clear ownership.
4. **Approval gate.** Any task with financial impact, external communication (emails, posts, DMs), production database changes, or irreversible actions must be moved to `Needs_Approval/` and explicitly confirmed by the human operator before execution.
5. **No agent acts outside its domain.** Dev Agent does not make growth/pricing decisions. Growth Agent does not touch code or infra. Ops Agent does not write marketing copy. Escalate cross-domain needs to the Orchestrator.
6. **Memory before action.** Every agent reads relevant files in `04-Memory/` before starting a task to stay consistent with prior decisions, known leads, architecture constraints, and user feedback.
7. **Log everything.** On completion, agents append a short entry to the relevant `04-Memory/` file (if state changed) and the task file is moved to `Completed/` with a one-line summary and timestamp.
8. **Daily rollup.** The Orchestrator produces one file per day in `05-Daily-Briefings/` summarizing what shipped, what's pending, what needs approval, and what's blocked.
9. **Secrets stay out of markdown.** No agent writes API keys, tokens, or `.env` values into any SPARK_OS file.
10. **Escalate ambiguity.** If a task's intent, scope, or ownership is unclear, the agent stops and files it back to `01-Inbox/` with a note rather than guessing.

## Handoff Protocol

- **Dev → Ops:** Once a feature ships, Dev Agent notifies Ops Agent to monitor for errors/performance regressions post-deploy.
- **Growth → Dev:** Feature requests sourced from leads/customers go through Growth Agent first, then get filed as a Dev task with context on the requesting segment.
- **Ops → Orchestrator:** Any metric anomaly (churn spike, error rate spike, infra cost spike) is escalated immediately, not held for the daily rollup.
- **Any Agent → Orchestrator:** Escalate blockers, ambiguous scope, or cross-domain conflicts.
