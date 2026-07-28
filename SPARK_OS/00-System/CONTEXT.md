# SPARK — System Context

## Vision

SPARK is the AI Operating System for real estate agents. Instead of stitching together a CRM, a content tool, a coach, a videographer, and a market-report service, agents run their entire business through one AI layer.

SPARK Autopilot continuously monitors clients, detects deal risk, and tells the agent exactly what to do each day. When an agent needs to think something through, SPARK Assistant is available with full context on the business — no re-explaining, no context switching.

**North star:** agents should spend their time selling, not running their business.

## Positioning

- **Category:** AI Operating System for Real Estate Agents (not "another CRM").
- **Wedge:** Autopilot — passive monitoring and proactive risk detection — is the differentiator vs. static CRMs and generic AI chat tools.
- **Replacing:** CRMs, content/social tools, coaching subscriptions, videographers, and manual market research.
- **Target customer:** individual agents and small teams at RE/MAX, Compass, Keller Williams, and independent brokerages.
- **Pricing motion:** free tier (10 credits, no card, ~30 second setup) → paid conversion once agents see Autopilot catch something they would have missed.
- **Tone:** confident, fast, high-signal. Agents are busy — SPARK respects their time and never buries them in dashboards.

## Product Pillars

1. **Autopilot** — passive client monitoring, deal risk detection, daily action list.
2. **Deal Negotiator / War Room** — AI-assisted negotiation support with full deal context.
3. **Market Intelligence** — autonomous market surveillance and reporting, no manual pulls.
4. **Assistant** — conversational interface with full business context, available on demand.

## Tech Stack

- **Frontend:** React 18 + Vite 4, Tailwind CSS
- **Backend & Database:** Supabase (Auth, Postgres, Realtime)
- **Payments:** Stripe
- **Analytics:** PostHog
- **Notifications:** web-push
- **Media processing:** ffmpeg (via `@ffmpeg-installer/ffmpeg`)
- **Deployment:** Vercel (see `vercel.json` for routing/build config)
- **Serverless functions:** `/api` directory
- **Version control:** GitHub (`leobax01-dev/Spark-app`)
- **Execution engine:** Claude Code CLI / Claude Desktop, orchestrated via SPARK_OS

See [tech-stack.md](tech-stack.md) for the condensed infra reference and [Architecture.md](../04-Memory/Architecture.md) for directory-level detail.

## Operating Principles

- Ship fast, but never at the cost of client data integrity — agents' businesses run on this.
- Every automated action Autopilot takes must be explainable to the agent in plain language.
- Prefer proactive detection over reactive dashboards — surface the 3 things that matter today, not 30 metrics.
- Keep the product opinionated. Real estate agents don't want to configure a CRM; they want SPARK to already know what to do.
