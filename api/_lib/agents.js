// api/_lib/agents.js — intent classification for the Alfred voice engine.
// Routes a spoken/typed directive to the C-Suite agent whose domain it
// matches, per SPARK_OS/03-Agents/*.md. Deterministic keyword scoring
// (not an LLM call) so routing is fast, free, and testable.

export const AGENTS = {
  CFO: {
    owner: "CFO_Agent",
    slug: "cfo",
    label: "the CFO Agent",
    keywords: [
      "financ", "mrr", "arr", "revenue", "seat econom", "pricing", "price",
      "budget", "cost", "subscription", "stripe", "billing", "unit econom",
      "cash", "runway", "margin", "forecast",
    ],
  },
  CTO: {
    owner: "CTO_Agent",
    slug: "cto",
    label: "the CTO Agent",
    keywords: [
      "architect", "code audit", "supabase", "rls", "row level security",
      "row-level security", "multi-tenan", "backend", "database", "db",
      "schema", "api", "deploy", "infrastructure", "webhook", "integration",
      "brokerage_id", "team_id",
    ],
  },
  CMO: {
    owner: "CMO_Agent",
    slug: "cmo",
    label: "the CMO Agent",
    keywords: [
      "launch copy", "email", "announcement", "gtm", "go-to-market",
      "campaign", "brand", "marketing", "social", "founding member",
      "landing page", "messaging", "content",
    ],
  },
  CRO: {
    owner: "CRO_Agent",
    slug: "cro",
    label: "the CRO Agent",
    keywords: [
      "enterprise sales", "pipeline", "white-label", "white label",
      "brokerage", "deal", "outreach", "partnership", "prospect",
      "close", "quota", "account executive",
    ],
  },
  CEO: {
    owner: "CEO_Agent",
    slug: "ceo",
    label: "the CEO Agent",
    keywords: [
      "briefing", "launch readiness", "summary", "status", "standup",
      "overall", "roadmap", "priorit",
    ],
  },
};

// Returns the AGENTS key (CFO/CTO/CMO/CRO/CEO) with the strongest keyword
// match. CEO is both a real category and the fallback default, per spec.
export function classifyIntent(text) {
  const t = (text || "").toLowerCase();
  let best = "CEO";
  let bestScore = 0;
  for (const [key, agent] of Object.entries(AGENTS)) {
    const score = agent.keywords.reduce((n, kw) => (t.includes(kw) ? n + 1 : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}

export function extractPriority(text) {
  const t = (text || "").toLowerCase();
  if (/\b(urgent|asap|immediately|right away|high priority|critical)\b/.test(t)) return "High";
  if (/\b(low priority|whenever|no rush|eventually)\b/.test(t)) return "Low";
  return "Medium";
}

// Quick-query detector: direct-readout requests bypass task filing entirely.
export function isBriefingQuery(text) {
  const t = (text || "").toLowerCase();
  return /\b(today'?s brief|daily brief|daily summary|ceo report|launch readiness|give me the brief|status report)\b/.test(t);
}

// Strips a leading wake phrase ("hey alfred", "alfred", "excuse me alfred")
// from a transcript so only the actual directive is dispatched/filed.
export function stripWakePhrase(text) {
  return (text || "")
    .replace(/^\s*(hey\s+alfred|excuse me,?\s+alfred|alfred)[,:\s]*/i, "")
    .trim();
}
