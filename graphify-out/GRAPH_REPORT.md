# Graph Report - .  (2026-07-27)

## Corpus Check
- 79 files · ~82,643 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 507 nodes · 815 edges · 43 communities (35 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.88)
- Token cost: 181,689 input · 0 output

## Community Hubs (Navigation)
- SPARK_OS Agent Rules
- Billing API & Legal Pages
- App.jsx Core UI
- Autopilot Panel Core
- Package Dependencies
- Client Panel
- Shared UI Components
- Autopilot Checklist & Briefing
- Client-Side API Layer
- PWA Manifest
- Autopilot Daily Brief Generation
- Content History Feature
- Autopilot Cron Job
- Market Panel
- Vercel Function Config
- Google Data Integration
- Autopilot Market/Property Sync
- Stripe Webhook Handler
- App Sub-Panels (Affiliate/Auth/Compliance)
- Autonomous Loop Script
- Compliance Review Utils
- Billing & Onboarding Panels
- Error Boundary
- Billing Portal API
- App Entry Point
- Icon Components
- Founding Member Status API
- Video Stitch API
- Transaction Milestones
- Service Worker
- Supabase Client
- SPARK App Icon Asset
- README

## God Nodes (most connected - your core abstractions)
1. `lsGet()` - 34 edges
2. `lsSet()` - 22 edges
3. `useToast()` - 15 edges
4. `SPARK` - 15 edges
5. `cloudSync()` - 14 edges
6. `CEO Agent` - 12 edges
7. `cloudLoad()` - 11 edges
8. `CTO Agent` - 11 edges
9. `CMO Agent` - 10 edges
10. `AutopilotPanel()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `index.html (SPARK app entry HTML)` --conceptually_related_to--> `React 18 + Vite 4 Frontend`  [INFERRED]
  index.html → SPARK_OS/04-Memory/architecture.md
- `Supabase (database hosting provider)` --conceptually_related_to--> `Supabase Backend (Auth, Postgres, Realtime)`  [INFERRED]
  public/privacy.html → SPARK_OS/04-Memory/architecture.md
- `Stripe (payment processor)` --conceptually_related_to--> `Stripe Payments`  [INFERRED]
  public/privacy.html → SPARK_OS/04-Memory/architecture.md
- `Vercel (application hosting)` --conceptually_related_to--> `Vercel Deployment`  [INFERRED]
  public/privacy.html → SPARK_OS/04-Memory/architecture.md
- `Autopilot Client Monitoring & Risk Detection` --conceptually_related_to--> `Resend (transactional email provider)`  [INFERRED]
  SPARK_OS/04-Memory/product-vision.md → public/privacy.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Executive C-Suite Roster reporting to CEO Agent** — spark_os_03_agents_ceo_agent_ceo_agent, spark_os_03_agents_cto_agent_cto_agent, spark_os_03_agents_cfo_agent_cfo_agent, spark_os_03_agents_cmo_agent_cmo_agent, spark_os_03_agents_cro_agent_cro_agent [EXTRACTED 0.95]
- **GTM Launch Day sub-tasks across CMO, CTO, CFO, CEO** — spark_os_02_tasks_needs_approval_gtm_launch_day_1_cmo_subtask, spark_os_02_tasks_needs_approval_gtm_launch_day_1_cto_subtask, spark_os_02_tasks_needs_approval_gtm_launch_day_1_cfo_subtask, spark_os_02_tasks_needs_approval_gtm_launch_day_1_ceo_subtask [EXTRACTED 0.90]
- **Tactical execution agents (Dev, Growth, Ops) reporting through CEO** — spark_os_03_agents_dev_agent_dev_agent, spark_os_03_agents_growth_agent_growth_agent, spark_os_03_agents_ops_agent_ops_agent [EXTRACTED 0.90]
- **Launch Day GTM Workstream (Founding Member Launch)** — spark_os_02_tasks_pending_gtm_launch_day_1, spark_os_04_memory_architecture_rls_multitenant_audit, spark_os_04_memory_financial_metrics_financial_metrics, spark_os_02_tasks_needs_approval_founding_member_announcement_copy, spark_os_05_daily_briefings_2026_07_27_launch_readiness_summary [EXTRACTED 0.90]
- **SPARK Third-Party Service Providers** — public_privacy_html_anthropic, public_privacy_html_supabase_provider, public_privacy_html_stripe_provider, public_privacy_html_resend_provider, public_privacy_html_vercel_provider [EXTRACTED 0.90]
- **SPARK_OS C-Suite Agent Roster** — spark_os_04_memory_architecture_cto_agent, spark_os_04_memory_financial_metrics_cfo_agent, spark_os_05_daily_briefings_2026_07_27_cmo_agent, spark_os_04_memory_financial_metrics_cro_agent, spark_os_05_daily_briefings_2026_07_27_ceo_agent [EXTRACTED 0.90]

## Communities (43 total, 8 thin omitted)

### Community 0 - "SPARK_OS Agent Rules"
Cohesion: 0.09
Nodes (49): Approval Gate, Dev Agent, Growth Agent, Ops Agent, Orchestrator, SPARK_OS, Task Lifecycle (Pending to Needs_Approval to Completed), SPARK_OS Execution Rules for Claude Code (+41 more)

### Community 1 - "Billing API & Legal Pages"
Cohesion: 0.05
Nodes (44): index.html (SPARK app entry HTML), Privacy Policy — SPARK, Anthropic (Claude API data processor), Google API Services User Data Policy, Resend (transactional email provider), Stripe (payment processor), Supabase (database hosting provider), Vercel (application hosting) (+36 more)

### Community 2 - "App.jsx Core UI"
Cohesion: 0.05
Nodes (16): C, CONTENT_TYPES, CREDIT_PACKS, EMPTY_STATE_DEMOS, INPUT_META, inputStyle, LS, NotificationBar() (+8 more)

### Community 3 - "Autopilot Panel Core"
Cohesion: 0.06
Nodes (24): buildAgentContext(), buildAutopilotContext(), buildConversationMemoryContext(), buildGoogleContext(), buildSystem(), C, computeRosterStatus(), EXAMPLE_AP_RESULT (+16 more)

### Community 4 - "Package Dependencies"
Cohesion: 0.07
Nodes (28): @ffmpeg-installer/ffmpeg, dependencies, @ffmpeg-installer/ffmpeg, posthog-js, react, react-dom, stripe, @supabase/supabase-js (+20 more)

### Community 5 - "Client Panel"
Cohesion: 0.08
Nodes (13): ACTIVITY_TYPES, BLANK_CLIENT, C, ClientActivitySection(), ClientPanel(), ClientTagsSection(), FIELD_PATTERNS, RelationshipManagerHeader() (+5 more)

### Community 6 - "Shared UI Components"
Cohesion: 0.14
Nodes (7): Button(), Card(), CopyButton(), Label(), C, CoordinatorHeader(), TransactionPanel()

### Community 7 - "Autopilot Checklist & Briefing"
Cohesion: 0.20
Nodes (15): ActivationChecklist(), signatureFor(), updateValueLedger(), ClientImport(), ClientPipeline(), DailyBriefing(), SmartIntake(), BusinessDashboard() (+7 more)

### Community 8 - "Client-Side API Layer"
Cohesion: 0.16
Nodes (10): ToastCtx, C, CONTENT_TYPES, CREDIT_PACKS, INPUT_META, LS, PLAN_ORDER, PLANS (+2 more)

### Community 9 - "PWA Manifest"
Cohesion: 0.13
Nodes (14): background_color, categories, description, display, icons, name, orientation, scope (+6 more)

### Community 10 - "Autopilot Daily Brief Generation"
Cohesion: 0.21
Nodes (15): aggregateBusinessData(), AutopilotPanel(), buildOpeningBriefing(), buildStaticBriefing(), generateDailyBrief(), getMarketContext(), getSmartPrompts(), getValueLedgerTotal() (+7 more)

### Community 11 - "Content History Feature"
Cohesion: 0.17
Nodes (7): C, ContentHistory(), extractPreview(), extractTitle(), getHistory(), saveGeneration(), TYPE_META

### Community 12 - "Autopilot Cron Job"
Cohesion: 0.35
Nodes (13): aggregateBusinessData(), callClaude(), computeSphereCandidates(), daysSinceDate(), extractZip(), fetchMarketStats(), generateListingPerformance(), generateSphereReactivation() (+5 more)

### Community 13 - "Market Panel"
Cohesion: 0.14
Nodes (4): AnalystHeader(), C, LEAD_SOURCES, MarketPanel()

### Community 14 - "Vercel Function Config"
Cohesion: 0.14
Nodes (13): maxDuration, maxDuration, maxDuration, maxDuration, maxDuration, crons, functions, api/claude.js (+5 more)

### Community 15 - "Google Data Integration"
Cohesion: 0.32
Nodes (12): getCalendarData(), getGmailData(), getSupabase(), getValidToken(), handleAutopilot(), handler(), isTcpaSafeHour(), refreshAccessToken() (+4 more)

### Community 16 - "Autopilot Market/Property Sync"
Cohesion: 0.21
Nodes (13): apSync(), computeSphereCandidates(), daysSinceDate(), extractZip(), fetchMarketStats(), fetchPropertyComps(), generateListingPerformance(), generateNegotiationStrategy() (+5 more)

### Community 17 - "Stripe Webhook Handler"
Cohesion: 0.24
Nodes (10): alertUnmatchedPayment(), config, findUser(), getRawBody(), handler(), LINK_TO_CREDITS, LINK_TO_PLAN, PRODUCT_TO_PLAN (+2 more)

### Community 18 - "App Sub-Panels (Affiliate/Auth/Compliance)"
Cohesion: 0.18
Nodes (11): AffiliatePanel(), AuthPage(), CommissionCalculator(), ComplianceBanner(), CopyBtn(), DownloadButton(), GoogleIntegration(), PhotoUploader() (+3 more)

### Community 19 - "Autonomous Loop Script"
Cohesion: 0.53
Nodes (8): append_briefing_line(), complete_task(), ensure_briefing_exists(), log(), main(), route_task(), run_pass(), run-autonomous-loop.sh script

### Community 20 - "Compliance Review Utils"
Cohesion: 0.31
Nodes (8): GeneratePanel(), ChatMessage(), extractTextForReview(), reviewWithAI(), RISK_LABELS, RISKY_PATTERNS, runComplianceCheck(), scanForRiskyLanguage()

### Community 21 - "Billing & Onboarding Panels"
Cohesion: 0.36
Nodes (8): BillingPanel(), displayCredits(), goStripe(), MainApp(), OnboardingModal(), SettingsPanel(), track(), UpgradeModal()

### Community 25 - "App Entry Point"
Cohesion: 0.50
Nodes (3): App(), initAnalytics(), useStyles()

### Community 26 - "Icon Components"
Cohesion: 0.67
Nodes (3): base(), Icon, Svg()

### Community 29 - "Transaction Milestones"
Cohesion: 0.67
Nodes (3): calculateTransactionMilestones(), getCurrentMilestone(), TransactionCoordinator()

## Knowledge Gaps
- **107 isolated node(s):** `supabase`, `stripe`, `stripe`, `supabase`, `stripe` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `lsGet()` connect `Autopilot Daily Brief Generation` to `Autopilot Panel Core`, `Client Panel`, `Shared UI Components`, `Autopilot Checklist & Briefing`, `Market Panel`, `Autopilot Market/Property Sync`, `Transaction Milestones`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `ErrorBoundary` connect `Error Boundary` to `App.jsx Core UI`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `cloudSync()` connect `Autopilot Checklist & Briefing` to `Autopilot Panel Core`, `Client Panel`, `Shared UI Components`, `Content History Feature`, `Market Panel`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `supabase`, `stripe`, `stripe` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SPARK_OS Agent Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.0858843537414966 - nodes in this community are weakly interconnected._
- **Should `Billing API & Legal Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05319148936170213 - nodes in this community are weakly interconnected._
- **Should `App.jsx Core UI` be split into smaller, more focused modules?**
  _Cohesion score 0.048726467331118496 - nodes in this community are weakly interconnected._