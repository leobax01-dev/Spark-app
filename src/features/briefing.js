// src/features/briefing.js — 8am mission-briefing assembly.
//
// Pure logic, no JSX. Split out of CommandMatrix so the consolidated Autopilot
// header can render the audio module from the same briefing the Matrix body
// renders, without either file recomputing it or a non-component export
// breaking react-refresh's fast-refresh boundary.

export const HIGH_DOM = 60;

// Alerts dispatched from other terminals (currently the Transaction
// Intelligence board, when a hard-stop contingency date is set or moved).
// Folded into Panel A so a deadline change actually surfaces on the agent's
// homepage rather than only living in the Deals tab.
export const AUTOPILOT_ALERTS_KEY = "spark_autopilot_alerts_v1";

function readDispatchedAlerts() {
  try {
    const raw = localStorage.getItem(AUTOPILOT_ALERTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    // Drop anything already past its deadline — a stale alert is worse than
    // no alert, because it trains the agent to ignore the panel.
    return list.filter((a) => !a.dueAt || new Date(a.dueAt).getTime() > Date.now());
  } catch { return []; }
}

export function clockOf(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ── demo-safe fallback synthesizer ────────────────────────────────────────
// A brand-new account has nothing to brief on. Rather than showing an empty
// terminal, this stands up a complete 8am briefing for a fictional
// high-volume luxury agent. Everything it produces is badged SIM.
export const DEMO_BRIEFING = {
  simulated: true,
  pipelineValue: 4_180_000,
  headline: "Two positions need your judgment this morning. Everything else is handled.",
  threats: [
    {
      id: "demo-t1", severity: "critical", kind: "TRANSACTION RISK", simulated: true,
      subject: "Inspection objection deadline on 104 Elm St expires in 19 hours",
      detail: "The Whitmore contract ($2.4M) hit its inspection objection deadline at 5:00 PM tomorrow. The buyer's agent submitted a $38,000 repair request Tuesday and no response has been logged. If the deadline passes without a written response, the buyer can terminate and recover earnest money.",
      action: "Get a written position from the Whitmores today — accept, counter, or reject — and send it to the buyer's agent before 5:00 PM tomorrow.",
      value: 72_000,
    },
    {
      id: "demo-t2", severity: "high", kind: "SPHERE REACTIVATION", simulated: true,
      subject: "Caroline Ashford's one-year anniversary at 88 Harbor Point is Friday",
      detail: "Caroline closed a $3.1M purchase on Friday last year and referred two clients within her first six months. She has had no contact in 94 days. One-year anniversaries are the single highest-converting reactivation window in your sphere, and it closes this week.",
      action: "Send a personal anniversary note Friday morning with a current valuation of 88 Harbor Point. Do not attach a referral ask to the first touch.",
      value: 46_500,
    },
  ],
  ops: [
    // Worded to match what utils/compliance actually does — a fair-housing
    // language review of outbound copy. It does not verify disclosures on
    // file, so no op claims it does, even in the demo.
    { id: "demo-o1", at: "08:00", simulated: true, text: "Compliance language review passed for 104 Elm St outbound copy — 4 drafts cleared" },
    { id: "demo-o2", at: "08:00", simulated: true, text: "Listing performance chron-refresh complete — 6 active listings re-scored" },
    { id: "demo-o3", at: "08:01", simulated: true, text: "Sphere scan complete — 214 contacts evaluated, 3 reactivation windows opening" },
  ],
  metrics: { atRisk: 118_500, opportunity: 46_500, probability: 71 },
  specialists: {
    coordinator: { text: "Monitoring 3 deals under contract", tone: "warn" },
    negotiate: { text: "1 open repair-credit position", tone: "warn" },
    listings: { text: "Analyzing 12 comps across 6 listings", tone: "calm" },
    coaching: { text: "Tracking a follow-up pattern", tone: "info" },
  },
};

// ── live briefing assembly ────────────────────────────────────────────────
// Dispatched alerts are prepended to whichever briefing is returned. Each one
// carries the SIM flag of the deal it came from — a deadline dispatched off a
// synthesized demo deal is itself synthesized, and must not appear on the
// homepage as a real exposure.
function withDispatched(briefing) {
  const dispatched = readDispatchedAlerts();
  if (!dispatched.length) return briefing;
  const threats = dispatched.map((a) => ({
    id: `dispatch-${a.id}`,
    severity: a.severity === "critical" ? "critical" : "high",
    kind: a.kind || "CONTINGENCY DEADLINE",
    simulated: !!a.simulated,
    subject: a.subject,
    detail: a.detail,
    action: a.action || null,
    value: Number(a.value) || 0,
    _raw: a,
  }));
  const merged = [...threats, ...briefing.threats];
  // The demo headline is a fixed string that counts only its own two
  // scenarios; leaving it alone made the panel say "Two positions" while the
  // spoken briefing counted three.
  const headline = briefing.simulated
    ? `${merged.length} position${merged.length !== 1 ? "s" : ""} need your judgment this morning. Everything else is handled.`
    : briefing.headline;
  return { ...briefing, headline, threats: merged };
}

export function buildBriefing({
  isDemo, apResult, sphere, listingPerf, lastRun, pipelineValue = 0, specialistStatuses = {},
}) {
  if (isDemo || !apResult) return withDispatched(DEMO_BRIEFING);

  const di = apResult?.deal_intelligence || {};
  const threats = [];

  (di.risks || []).forEach((r, i) => {
    threats.push({
      id: `risk-${i}`,
      severity: r.severity === "high" || r.severity === "critical" ? "critical" : "high",
      kind: "TRANSACTION RISK", simulated: false,
      // The deal name heads the card and the risk is the body. Concatenating
      // both into the subject repeated the same sentence twice on screen.
      subject: r.deal || r.risk,
      detail: r.deal ? r.risk : (r.action || r.risk),
      action: r.deal ? r.action : null,
      value: Number(r.value) || 0,
      _raw: r,
    });
  });

  (apResult?.relationship_alerts || []).forEach((a, i) => {
    threats.push({
      id: `alert-${i}`, severity: "high", kind: "RELATIONSHIP DECAY", simulated: false,
      subject: `${a.client} has gone quiet for ${a.days} days`,
      detail: a.reason || `No contact logged in ${a.days} days.`,
      action: a.message ? `Send: "${String(a.message).slice(0, 130)}${String(a.message).length > 130 ? "…" : ""}"` : null,
      value: 0, _raw: a,
    });
  });

  (sphere?.opportunities || []).slice(0, 1).forEach((o, i) => {
    threats.push({
      id: `sphere-${i}`, severity: "high", kind: "SPHERE REACTIVATION", simulated: false,
      subject: `${o.name} — ${o.trigger}`,
      detail: o.why_now,
      action: o.message ? `Open with: "${String(o.message).slice(0, 130)}…"` : null,
      value: 0, _raw: o,
    });
  });

  // Background ops describe work this system genuinely performed. Nothing here
  // is invented — each line is gated on the artifact that proves it ran.
  const ops = [];
  const at = clockOf(lastRun);
  if (apResult?.client_scores?.length) {
    ops.push({ id: "op-scores", at, text: `Client scoring complete — ${apResult.client_scores.length} contact${apResult.client_scores.length !== 1 ? "s" : ""} re-scored` });
  }
  if (apResult?.market_intelligence?.insight) {
    ops.push({ id: "op-market", at, text: "Market intelligence refresh complete — pipeline zips re-pulled" });
  }
  if (sphere) {
    ops.push({ id: "op-sphere", at, text: `Sphere scan complete — ${sphere.total_dormant ?? 0} dormant contact${(sphere.total_dormant ?? 0) !== 1 ? "s" : ""} evaluated` });
  }
  if (listingPerf?.listings?.length) {
    ops.push({ id: "op-listings", at, text: `Listing performance chron-refresh complete — ${listingPerf.listings.length} listing${listingPerf.listings.length !== 1 ? "s" : ""} re-scored` });
  }
  if (apResult?.performance_forecast) {
    ops.push({ id: "op-forecast", at, text: `GCI forecast recomputed — ${apResult.performance_forecast.momentum || "steady"} momentum` });
  }

  const atRisk = (di.risks || []).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const opportunity = (di.opportunities || []).reduce((s, o) => s + (Number(o.value) || 0), 0);
  const scores = apResult?.client_scores || [];
  const probability = scores.length
    ? Math.round(scores.reduce((s, c) => {
      const p = parseInt(String(c.probability || "").replace("%", ""), 10);
      return s + (Number.isFinite(p) ? p : Number(c.score) || 0);
    }, 0) / scores.length)
    : 0;

  return withDispatched({
    simulated: false,
    pipelineValue,
    headline: apResult?.mission?.headline || "No critical positions this morning.",
    threats, ops,
    metrics: { atRisk, opportunity, probability },
    specialists: specialistStatuses,
  });
}

export function buildSpokenText(briefing, voice) {
  if (!briefing) return "";
  const name = (voice?.name || "").split(" ")[0];
  const n = briefing.threats.length;
  return [
    `Good morning${name ? `, ${name}` : ""}. This is your eight A.M. briefing.`,
    briefing.headline,
    n ? `${n} position${n !== 1 ? "s" : ""} require your judgment.` : "Nothing requires your judgment right now.",
    ...briefing.threats.slice(0, 2).map((t) => `${t.subject}. ${t.action || ""}`),
    briefing.ops.length ? `I handled ${briefing.ops.length} operation${briefing.ops.length !== 1 ? "s" : ""} in the background.` : "",
  ].filter(Boolean).join(" ");
}
