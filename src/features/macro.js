// src/features/macro.js — macro telemetry + inbound intent derivation.
//
// Pure logic, no JSX.
//
// Honesty rules encoded here:
//
// - The inbound queue is REAL where it can be. api/google-data.js's
//   capture_lead action writes submissions straight into the agent's client
//   array with source "spark_lead_capture", so those are genuine inbound
//   leads. Anything synthesized is badged SIM and never written back.
// - Intent score is a MODEL. It returns its factors so the dossier can show
//   its work; a bare "92" an agent cannot interrogate is worse than nothing.
// - Absorption rate needs active + pending + SOLD counts. This app has an
//   active-listing feed (RentCast) but no sold/pending feed, so months-of-
//   supply cannot be computed from real data and is always marked modeled.
//   Presenting a fabricated market-speed number would move real pricing
//   decisions on invented evidence.

export const INBOUND_SOURCES = {
  spark_lead_capture: { label: "SPARK Capture Page", weight: 18, real: true },
  zillow: { label: "Zillow Inquiry", weight: 20 },
  realtor: { label: "Realtor.com", weight: 18 },
  website: { label: "Website Form", weight: 18 },
  openhouse: { label: "Open House Sign-In", weight: 15 },
  referral: { label: "Referral", weight: 25 },
  social: { label: "Social DM", weight: 10 },
  omni_intake: { label: "Voice / Note Intake", weight: 12, real: true },
  migration: { label: "Migrated Record", weight: 4, real: true },
};

export function sourceMeta(raw) {
  const key = String(raw || "").toLowerCase();
  if (INBOUND_SOURCES[key]) return { key, ...INBOUND_SOURCES[key] };
  const hit = Object.entries(INBOUND_SOURCES).find(([k]) => key.includes(k));
  if (hit) return { key: hit[0], ...hit[1] };
  return { key: "unknown", label: raw ? String(raw) : "Unattributed", weight: 6 };
}

export function parseMoney(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = String(raw).toLowerCase();
  const hits = [...text.matchAll(/([\d,]+(?:\.\d+)?)\s*([mk])?/g)].map((m) => {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) return null;
    if (m[2] === "m") return n * 1_000_000;
    if (m[2] === "k") return n * 1_000;
    return n >= 1_000 ? n : null;
  }).filter(Boolean);
  return hits.length ? Math.max(...hits) : null;
}

export function minutesSince(d) {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60_000));
}

export function agoLabel(mins) {
  if (mins == null) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

// ── intent model ──────────────────────────────────────────────────────────
// Coarse on purpose. These inputs are a form submission and a free-text
// message; a score to two decimals would imply precision they cannot support.
export function intentScore(lead) {
  const factors = [];
  let score = 15;
  factors.push({ label: "Base", delta: 15 });

  const src = sourceMeta(lead.source);
  score += src.weight;
  factors.push({ label: `Source: ${src.label}`, delta: src.weight });

  if (lead.phone) { score += 10; factors.push({ label: "Phone provided", delta: 10 }); }
  if (lead.email) { score += 5; factors.push({ label: "Email provided", delta: 5 }); }

  const msg = String(lead.message || lead.motivation || "").toLowerCase();
  // "available" on its own is too loose — it also matches "proof of funds
  // available", which credited a showing request the lead never made and
  // showed the agent a factor that wasn't in their message. Availability only
  // counts when it is clearly about the property.
  if (/when can i|can i see|schedule a (showing|tour)|book a (showing|tour)|(still|it|this|is it) available|view it|walk ?through|come by|take a look/.test(msg)) {
    score += 18; factors.push({ label: "Asked to see it", delta: 18 });
  }
  if (/pre-?approved|cash|proof of funds|financing in place/.test(msg)) {
    score += 15; factors.push({ label: "Financing signalled", delta: 15 });
  }
  if (/asap|this week|weekend|today|tomorrow|urgent/.test(msg)) {
    score += 12; factors.push({ label: "Urgent timeframe", delta: 12 });
  }
  if (/just looking|browsing|curious|not ready|someday/.test(msg)) {
    score -= 12; factors.push({ label: "Low-commitment language", delta: -12 });
  }

  const price = parseMoney(lead.propertyPrice || lead.budget);
  if (price && price >= 1_000_000) { score += 8; factors.push({ label: "$1M+ target", delta: 8 }); }

  const mins = minutesSince(lead.createdAt);
  if (mins != null) {
    if (mins <= 60) { score += 10; factors.push({ label: "Under an hour old", delta: 10 }); }
    else if (mins >= 10080) { score -= 10; factors.push({ label: "Over a week old", delta: -10 }); }
  }

  return { score: Math.max(3, Math.min(98, Math.round(score))), factors };
}

export function enrichLead(raw) {
  const src = sourceMeta(raw.source);
  const intent = intentScore(raw);
  const mins = minutesSince(raw.createdAt);
  return {
    ...raw,
    sourceLabel: src.label,
    sourceKey: src.key,
    mins,
    ago: agoLabel(mins),
    // "Fresh" drives the pulsing green border: uncontacted and under 5 minutes
    // old is the window where response time actually changes the outcome.
    fresh: mins != null && mins < 5 && !raw.contacted,
    intent: intent.score,
    intentFactors: intent.factors,
  };
}

// Real inbound comes from the client store — capture_lead writes there.
export function leadsFromClients(clients = []) {
  return clients
    .filter((c) => c.source && /lead_capture|omni_intake|zillow|realtor|website|referral|openhouse|social/i.test(c.source))
    .map((c) => enrichLead({
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      source: c.source, propertyAddress: c.property || "",
      propertyPrice: c.budget || "", message: c.motivation || c.notes || "",
      createdAt: c.createdAt || c.lastContact, stage: c.stage,
      contacted: c.stage && c.stage !== "prospect",
      simulated: false, _clientId: c.id,
    }));
}

// ── HUD ───────────────────────────────────────────────────────────────────
export function macroTelemetry({ leads, goals = {}, deals = [], farms = [] }) {
  const THIRTY = 30 * 1440;
  const recent = leads.filter((l) => l.mins != null && l.mins <= THIRTY);
  const converted = recent.filter((l) => l.contacted).length;
  const cvr = recent.length ? (converted / recent.length) * 100 : 0;

  const ytd = parseMoney(goals.yearToDate) || 0;
  const monthly = parseMoney(goals.monthlyGciTarget) || 0;
  const annualTarget = monthly * 12;
  const pct = annualTarget > 0 ? Math.min(100, (ytd / annualTarget) * 100) : null;

  return {
    leads30: recent.length,
    cvr,
    ytd, annualTarget, gciPct: pct,
    farms: farms.length,
    farmsMonitored: farms.filter((f) => f.active !== false).length,
    pipelineOpen: deals.filter((d) => String(d.stage || "").toLowerCase() !== "closed").length,
  };
}

// ── absorption ────────────────────────────────────────────────────────────
// Months of supply = active inventory / monthly sales pace. Without a sold
// feed the denominator is unknown, so this returns modeled:true and the UI
// must badge it. Never returns a real-looking number from invented sales.
export function absorption({ active, monthlySales }) {
  if (!active || !monthlySales) {
    return { months: null, label: "Unavailable", modeled: true, reason: "No sold-listing feed is wired up, so sales pace is unknown." };
  }
  const months = active / monthlySales;
  const label = months < 3 ? "Strong seller market"
    : months < 5 ? "Seller market"
      : months < 7 ? "Balanced"
        : "Buyer market";
  return { months, label, modeled: false, reason: "" };
}

// ── demo synthesizer ──────────────────────────────────────────────────────
const MIN = 60_000;
const ago = (m) => new Date(Date.now() - m * MIN).toISOString();

export function synthesizeLeads() {
  return [
    {
      id: "sim-l1", simulated: true, name: "Priyanka Anand", phone: "305-555-0142",
      email: "p.anand@example.com", source: "zillow",
      propertyAddress: "1000 S Pointe Dr #2201, Miami Beach", propertyPrice: "$2.4M",
      message: "Is this still available? Pre-approved and could see it this weekend if possible.",
      createdAt: ago(2), stage: "prospect", contacted: false,
    },
    {
      id: "sim-l2", simulated: true, name: "Whitaker Family Office", phone: "",
      email: "acquisitions@example.com", source: "website",
      propertyAddress: "7 Casuarina Concourse, Coral Gables", propertyPrice: "$8.9M",
      message: "Representing a buyer relocating from Greenwich. Cash, proof of funds available. Need to move fast.",
      createdAt: ago(34), stage: "prospect", contacted: false,
    },
    {
      id: "sim-l3", simulated: true, name: "Dev Ramaswamy", phone: "786-555-0188",
      email: "", source: "openhouse",
      propertyAddress: "3401 N Miami Ave, Edgewater", propertyPrice: "$740K",
      message: "Signed in at the open house. When can I see the unit upstairs?",
      createdAt: ago(310), stage: "prospect", contacted: false,
    },
    {
      id: "sim-l4", simulated: true, name: "Camille Fortier", phone: "305-555-0117",
      email: "camille.f@example.com", source: "referral",
      propertyAddress: "", propertyPrice: "$1.6M",
      message: "Marcus Webb gave me your name. We're starting to look, no rush — probably spring.",
      createdAt: ago(1490), stage: "active", contacted: true,
    },
    {
      id: "sim-l5", simulated: true, name: "Anon (Instagram)", phone: "",
      email: "", source: "social",
      propertyAddress: "Star Island", propertyPrice: "",
      message: "just looking at what's on star island lol",
      createdAt: ago(4300), stage: "prospect", contacted: false,
    },
  ].map(enrichLead);
}

// Micro-farms: hyper-local areas the agent monitors. Real once they add one;
// these demo rows are badged SIM. Active/pending counts here are illustrative,
// not pulled from a live MLS.
export function synthesizeFarms() {
  return [
    { id: "sim-f1", simulated: true, name: "Brickell Key", type: "Building cluster", active: 34, pending: 11, medianPsf: 1180, momPct: 2.4, dom: 46 },
    { id: "sim-f2", simulated: true, name: "Coral Gables — Old Cutler", type: "Neighborhood", active: 21, pending: 4, medianPsf: 940, momPct: -1.1, dom: 71 },
    { id: "sim-f3", simulated: true, name: "Sunset Islands", type: "Neighborhood", active: 9, pending: 5, medianPsf: 2140, momPct: 4.8, dom: 38 },
    { id: "sim-f4", simulated: true, name: "Edgewater High-Rise", type: "Building cluster", active: 58, pending: 19, medianPsf: 810, momPct: 0.6, dom: 52 },
    { id: "sim-f5", simulated: true, name: "Key Biscayne", type: "Neighborhood", active: 17, pending: 3, medianPsf: 1490, momPct: 1.9, dom: 63 },
  ];
}

// 12 months of city-wide trend. Synthesized — this app has no historical
// price index feed, so the Macro Matrix badges the whole series SIM.
export function synthesizeMacroSeries() {
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const base = 985;
  return months.map((m, i) => ({
    month: m,
    medianPsf: Math.round(base + i * 11 + Math.sin(i / 1.7) * 22),
    inventory: Math.round(1420 - i * 18 + Math.cos(i / 2.1) * 60),
    rate: +(7.1 - i * 0.075 + Math.sin(i / 3) * 0.12).toFixed(2),
  }));
}
