// src/features/sphere.js — sphere telemetry derivation.
//
// Pure logic, no JSX. Every number the Reactivation Grid shows is DERIVED from
// the agent's own client records, not stored — so the derivation lives in one
// place where it can be read and checked.
//
// Honesty rules encoded here:
//
// - Move probability is a MODEL, not a measurement. It is always returned with
//   the factors that produced it so the dossier can show its work; a bare
//   "87%" that an agent cannot interrogate is worse than no score.
// - Capital tier comes from the budget the agent typed. When no budget exists
//   the tier is "—", never a guess.
// - Only two trigger types are derivable from real records: home anniversary
//   (needs a close date) and dormancy (needs a last-contact date). Rate drops
//   and comp-sold events need a market feed this screen is not wired to, so
//   they exist ONLY on synthesized demo clients and carry simulated:true.

export const TIERS = {
  A: { id: "A", label: "Tier A", min: 2_000_000, color: "#8b5cf6" },
  B: { id: "B", label: "Tier B", min: 750_000, color: "#38bdf8" },
  C: { id: "C", label: "Tier C", min: 0, color: "#94a3b8" },
};

export const TRIGGER_TYPES = {
  ANNIVERSARY: { id: "ANNIVERSARY", label: "Home Anniversary", color: "#10b981" },
  DORMANT: { id: "DORMANT", label: "Dormant Sphere", color: "#f59e0b" },
  RATE_DROP: { id: "RATE_DROP", label: "Rate Drop", color: "#38bdf8" },
  COMP_SOLD: { id: "COMP_SOLD", label: "Target Comp Sold", color: "#8b5cf6" },
};

// Parses "$800k", "1.2M", "800,000 - 1.2m", "up to $2.5M" → a single number.
// Takes the TOP of a range: it represents buying power, and the ceiling is the
// number that determines what an agent can actually show them.
export function parseBudget(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = String(raw).toLowerCase();
  const matches = [...text.matchAll(/([\d,]+(?:\.\d+)?)\s*([mk])?/g)]
    .map((m) => {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isFinite(n)) return null;
      if (m[2] === "m") return n * 1_000_000;
      if (m[2] === "k") return n * 1_000;
      // A bare number under 10000 in a budget field is almost certainly
      // shorthand ("800" = $800k), but guessing that silently would inflate
      // liquidity. Only treat >= 10000 as a literal dollar figure.
      return n >= 10_000 ? n : null;
    })
    .filter((n) => n != null && n > 0);
  return matches.length ? Math.max(...matches) : null;
}

export function capitalTier(client) {
  const b = parseBudget(client.budget);
  if (b == null) return { id: "—", label: "Unknown", color: "#94a3b8", value: null };
  if (b >= TIERS.A.min) return { ...TIERS.A, value: b };
  if (b >= TIERS.B.min) return { ...TIERS.B, value: b };
  return { ...TIERS.C, value: b };
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export function lastTouch(client) {
  const acts = Array.isArray(client.activities) ? client.activities : [];
  const dates = [client.lastContact, ...acts.map((a) => a.date || a.at || a.createdAt)]
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (!dates.length) return { at: null, days: null };
  const at = Math.max(...dates);
  return { at, days: Math.floor((Date.now() - at) / 86_400_000) };
}

// ── triggers ──────────────────────────────────────────────────────────────
export function deriveTriggers(client, detail = {}) {
  const out = [];

  // Home anniversary — needs a real close date. `createdAt` is when the record
  // was made, not when they closed, so an anniversary derived from it is
  // flagged approximate rather than presented as fact.
  const closedAt = detail.closedAt || (client.stage === "closed" ? client.createdAt : null);
  if (closedAt) {
    const d = daysSince(closedAt);
    if (d != null) {
      const intoYear = d % 365;
      const years = Math.floor(d / 365);
      if (years >= 1 && (intoYear <= 21 || intoYear >= 344)) {
        out.push({
          ...TRIGGER_TYPES.ANNIVERSARY,
          detail: `${years}-year anniversary${intoYear >= 344 ? " in " + (365 - intoYear) + "d" : intoYear === 0 ? " today" : " " + intoYear + "d ago"}`,
          approximate: !detail.closedAt,
          simulated: false,
        });
      }
    }
  }

  const { days } = lastTouch(client);
  if (days != null && days >= 90 && client.stage === "closed") {
    out.push({
      ...TRIGGER_TYPES.DORMANT,
      detail: `${days} days without contact`,
      approximate: false, simulated: false,
    });
  }

  // Market-event triggers are attached by the synthesizer only — this screen
  // has no rate or comp feed wired to it.
  (detail.marketTriggers || []).forEach((t) => {
    const base = TRIGGER_TYPES[t.type];
    if (base) out.push({ ...base, detail: t.detail, approximate: false, simulated: true });
  });

  // One trigger per type. A duplicate would double-count in the HUD and add
  // its probability weight twice, quietly inflating the score.
  const seen = new Set();
  return out.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
}

// ── move probability ──────────────────────────────────────────────────────
// Returns the score AND the factors that made it, so the dossier can show its
// work. Weights are deliberately coarse — this is a prioritisation heuristic,
// not a prediction, and presenting it to two decimal places would imply a
// precision the inputs cannot support.
export function moveProbability(client, triggers = []) {
  const factors = [];
  let score = 20;
  factors.push({ label: "Base rate", delta: 20 });

  const stageWeights = { contract: 45, active: 25, prospect: 5, closed: 0 };
  const sw = stageWeights[client.stage] ?? 0;
  if (sw) { score += sw; factors.push({ label: `Stage: ${client.stage}`, delta: sw }); }

  const { days } = lastTouch(client);
  if (days != null) {
    let rw = 0;
    if (days <= 14) rw = 15;
    else if (days <= 30) rw = 8;
    else if (days > 90) rw = -10;
    if (rw) { score += rw; factors.push({ label: `Last touch ${days}d ago`, delta: rw }); }
  } else {
    score -= 5;
    factors.push({ label: "No contact ever logged", delta: -5 });
  }

  const t = String(client.timeline || "").toLowerCase();
  if (/asap|immediate|30 day|this month|now/.test(t)) { score += 20; factors.push({ label: "Timeline: immediate", delta: 20 }); }
  else if (/60 day|90 day|3 month|spring|summer|fall/.test(t)) { score += 10; factors.push({ label: "Timeline: near-term", delta: 10 }); }
  else if (/next year|someday|no rush|eventually/.test(t)) { score -= 5; factors.push({ label: "Timeline: distant", delta: -5 }); }

  triggers.forEach((tr) => {
    const d = tr.id === "ANNIVERSARY" ? 12 : tr.id === "RATE_DROP" ? 8 : tr.id === "COMP_SOLD" ? 10 : 4;
    score += d;
    factors.push({ label: `Trigger: ${tr.label}`, delta: d });
  });

  if ((client.tags || []).some((g) => /vip|priority|hot/i.test(g))) {
    score += 5; factors.push({ label: "Tagged VIP/priority", delta: 5 });
  }

  const final = Math.max(3, Math.min(97, Math.round(score)));
  return { score: final, factors };
}

export function nextDirective(client, triggers, prob) {
  const first = triggers[0];
  const name = (client.name || "").split(" ")[0] || "them";
  if (first?.id === "ANNIVERSARY") return `Send an anniversary note with a current valuation. No referral ask on the first touch.`;
  if (first?.id === "RATE_DROP") return `Lead with the rate move and what it changes about ${name}'s monthly payment.`;
  if (first?.id === "COMP_SOLD") return `Send the comp that just closed on their block before they see it on Zillow.`;
  if (first?.id === "DORMANT") return `Warm re-open — no agenda, no ask. Re-establish contact before pitching anything.`;
  if (client.stage === "contract") return `Under contract — protect it. Confirm the next contingency date in writing.`;
  if (prob >= 70) return `High intent. Get a showing or a listing appointment on the calendar this week.`;
  if (client.stage === "prospect") return `Qualify: budget, timeline, motivation. You cannot prioritise what you have not asked.`;
  return `Maintain cadence — a touch every 3 weeks keeps this from going cold.`;
}

// Enriches a raw client record with everything the grid renders.
export function enrichClient(client, detail = {}) {
  const triggers = deriveTriggers(client, detail);
  const { score, factors } = moveProbability(client, triggers);
  const tier = capitalTier(client);
  const touch = lastTouch(client);
  return {
    ...client,
    _detail: detail,
    tier, triggers, touch,
    probability: score,
    probabilityFactors: factors,
    directive: nextDirective(client, triggers, score),
    hot: score >= 80 || triggers.length > 0,
  };
}

// ── HUD aggregates ────────────────────────────────────────────────────────
export function sphereTelemetry(enriched) {
  // Liquidity counts only clients with a budget the agent actually entered,
  // and only those still in play — a closed client's old budget is not
  // current buying power.
  const liquid = enriched.filter((c) => c.tier.value != null && c.stage !== "closed");
  const liquidity = liquid.reduce((s, c) => s + c.tier.value, 0);

  const dormant = enriched.filter((c) =>
    c.triggers.some((t) => t.id === "DORMANT") || (c.stage === "closed" && c.probability >= 45)).length;

  const triggersThisWeek = enriched.reduce((n, c) => n + c.triggers.length, 0);

  // "Top 50" by probability, per the brief — with fewer than 50 clients it is
  // simply everyone with a logged touch.
  const top = [...enriched].sort((a, b) => b.probability - a.probability).slice(0, 50);
  const touched = top.filter((c) => c.touch.days != null);
  const avgDays = touched.length
    ? Math.round(touched.reduce((s, c) => s + c.touch.days, 0) / touched.length)
    : null;

  return {
    liquidity, liquidityCount: liquid.length,
    dormant, triggersThisWeek,
    avgDays, networkSize: enriched.length, scoredCount: touched.length,
  };
}

// ── demo-safe synthesizer ─────────────────────────────────────────────────
// 15 luxury clients: hot active buyers, dormant past sellers ripe for
// reactivation, and HNW investors carrying market triggers. Every record is
// badged SIM and never written to the agent's ledger.
const DAY = 86_400_000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();

export function synthesizeSphere() {
  const rows = [
    ["Alessandra Ruiz", "buyer", "active", "$3.4M", "ASAP — relocating for work", 6, ["VIP"], "Sunset Islands waterfront", null, null],
    ["Grant Whitfield", "both", "contract", "$5.9M", "Under contract, closing in 30 days", 2, ["VIP"], "Star Island estate", null, null],
    ["Priya & Sam Ochoa", "buyer", "active", "$1.85M", "60 days", 11, [], "Coconut Grove, 4BR", null, null],
    ["Marcus Webb", "seller", "closed", "$2.1M", "", 352, [], "88 Harbor Point", 366, null],
    ["Caroline Ashford", "seller", "closed", "$3.1M", "", 94, ["VIP"], "1420 Bayshore Ct", 358, [{ type: "COMP_SOLD", detail: "Neighbour closed 9% over ask" }]],
    ["Dr. Elena Vasquez", "buyer", "active", "$6.5M", "Spring", 19, ["VIP"], "Indian Creek — off-market only", null, [{ type: "RATE_DROP", detail: "Jumbo rate down 40bps" }]],
    ["The Kwan Trust", "buyer", "prospect", "$12M", "No rush — portfolio play", 41, ["VIP"], "Multi-property investor", null, null],
    ["Terrence Boyle", "seller", "closed", "$980K", "", 168, [], "217 Palm Ct", 171, null],
    ["Nadia Haddad", "buyer", "active", "$2.4M", "30 days", 4, [], "Brickell penthouse", null, [{ type: "RATE_DROP", detail: "Jumbo rate down 40bps" }]],
    ["Julian Ferro", "both", "prospect", "$4.2M", "Next year", 63, [], "Considering a 1031 exchange", null, null],
    ["Rosalind Achebe", "seller", "closed", "$1.6M", "", 372, [], "9 Sable Chase", 379, null],
    ["Bennett Holdings LLC", "buyer", "active", "$8.75M", "Immediate — 1031 deadline", 8, ["VIP"], "Commercial-to-resi conversion", null, [{ type: "COMP_SOLD", detail: "Comparable block trade at $9.2M" }]],
    ["Sofia Lindqvist", "buyer", "prospect", "$1.1M", "90 days", 27, [], "First-time buyer, pre-approved", null, null],
    ["Harold & June Pike", "seller", "closed", "$720K", "", 212, [], "44 Marlin Row", 218, null],
    ["Devon Castellanos", "buyer", "active", "$2.95M", "ASAP", 13, ["Hot"], "Key Biscayne, needs dock", null, null],
  ];

  return rows.map(([name, type, stage, budget, timeline, touchDays, tags, property, closedDays, marketTriggers], i) => ({
    id: `sim-c-${i}`,
    simulated: true,
    name, type, stage, budget, timeline, property,
    tags: tags || [],
    phone: `305-555-0${(100 + i).toString().slice(-3)}`,
    email: `${name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    lastContact: ago(touchDays),
    createdAt: ago(touchDays + 120),
    activities: [],
    _synthDetail: {
      closedAt: closedDays ? ago(closedDays) : null,
      marketTriggers: marketTriggers || [],
      connections: [],
      portfolio: property && stage === "closed"
        ? [{ address: property, estValue: (parseBudget(budget) || 0) * 1.08, rate: (4.75 + (i % 5) * 0.25).toFixed(2), purchasedAt: closedDays ? ago(closedDays) : null }]
        : [],
    },
  }));
}

// The synthesizer's connection graph is built after the fact so it can
// reference real ids from the generated set.
export function linkSynthConnections(list) {
  const byName = (n) => list.find((c) => c.name === n)?.id;
  const links = {
    "Alessandra Ruiz": ["Devon Castellanos"],
    "Marcus Webb": ["Caroline Ashford", "Terrence Boyle"],
    "Caroline Ashford": ["Marcus Webb", "Dr. Elena Vasquez"],
    "The Kwan Trust": ["Bennett Holdings LLC", "Julian Ferro"],
    "Bennett Holdings LLC": ["The Kwan Trust"],
    "Rosalind Achebe": ["Harold & June Pike"],
  };
  list.forEach((c) => {
    const names = links[c.name] || [];
    c._synthDetail.connections = names
      .map((n) => ({ id: byName(n), name: n, via: "Referral" }))
      .filter((x) => x.id);
  });
  return list;
}
