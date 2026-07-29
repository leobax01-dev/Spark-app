// api/_lib/copilot.js — "Spark," the Broker Copilot's data layer + brain.
// Single canonical implementation — this used to be duplicated across
// api/ai/broker-copilot.js's own queries and api/spark.js's separate
// fetch/aggregate logic; both endpoints now call into this file instead so
// there's one source of truth for what "Spark" knows and how it's scoped.
//
// Every query function here takes an explicit brokerageId and filters on
// it server-side — this is the actual cross-firm isolation boundary, not
// just Postgres RLS. Callers use the service-role Supabase client (bypasses
// RLS entirely), so leaking another brokerage's data would be a bug in
// THIS file, full stop. Every query below has a `.eq("brokerage_id", ...)`
// — if you add a new one, keep that invariant.
import { createClient } from "@supabase/supabase-js";

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase env vars not configured (SUPABASE_URL and SUPABASE_SERVICE_KEY).");
  }
  _supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _supabase;
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SPARK_SYSTEM_PROMPT =
  "You are Spark, an elite executive real estate intelligence AI and managing partner for brokerage command suites. Your tone is sharp, concise, authoritative, and data-driven like a military or corporate HUD assistant. You speak directly to the broker, analyzing firm-wide pipelines, agent velocity, and at-risk deals with absolute precision. Never reference generic data outside the provided brokerage context.";

async function callClaude(userPrompt, maxTokens = 500) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: SPARK_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

// ── Secure, brokerage-scoped fetches ────────────────────────────────────
// Deliberately fixed, parameterized queries — not a freeform text-to-SQL /
// arbitrary-tool-call loop. The LLM never sees a database connection or
// gets to construct its own query; it only ever sees the pre-aggregated
// JSON built from these. That's what actually makes cross-firm leakage
// impossible here, not a prompt instruction telling the model to behave.

async function getDeals(brokerageId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("deals")
    .select("id, agent_id, client_name, address, deal_volume, gci, commission_split_pct, stage, status, probability, closing_date, war_room_active, last_activity_at")
    .eq("brokerage_id", brokerageId);
  if (error) throw new Error(`getDeals failed: ${error.message}`);
  // commission payout is derived, not stored (see migration comment) — computed
  // once here so every caller (ledger UI, Spark's prompt context) uses the
  // same number instead of each re-deriving it slightly differently.
  return data.map((d) => ({
    ...d,
    commissionPayout: (Number(d.gci) || 0) * ((Number(d.commission_split_pct) || 0) / 100),
  }));
}

async function getAgents(brokerageId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select("id, email, role").eq("brokerage_id", brokerageId);
  if (error) throw new Error(`getAgents failed: ${error.message}`);
  return data;
}

async function getActiveWarRoomStatuses(brokerageId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("war_room_deals")
    .select("id, deal_name, negotiation_stage, user_id, updated_at")
    .eq("brokerage_id", brokerageId)
    .not("negotiation_stage", "in", "(closed,rejected)");
  if (error) throw new Error(`getActiveWarRoomStatuses failed: ${error.message}`);
  return data;
}

// Total Active Volume, Pending GCI, Deal Velocity, and At-Risk deals
// (status 'at_risk' OR probability < 50) — computed once, server-side, so
// every caller (and the LLM) reasons over the same trustworthy numbers
// instead of each re-deriving its own definition of "at risk."
function calculateFirmAggregates(deals) {
  const active = deals.filter((d) => d.stage !== "closed");
  const closed = deals.filter((d) => d.stage === "closed");

  const totalActiveVolume = active.reduce((sum, d) => sum + (Number(d.deal_volume) || 0), 0);
  const pendingGci = active.reduce((sum, d) => sum + (Number(d.gci) || 0), 0);
  const dealVelocity = deals.length > 0 ? Math.round((closed.length / deals.length) * 100) : 0;
  const atRiskDeals = deals.filter((d) => d.status === "at_risk" || Number(d.probability) < 50);

  return { totalActiveVolume, pendingGci, dealVelocity, atRiskCount: atRiskDeals.length, atRiskDeals };
}

function getAgentDealVolumes(deals, agents) {
  const emailById = Object.fromEntries(agents.map((a) => [a.id, a.email]));
  const byAgent = {};
  for (const d of deals) {
    const key = d.agent_id;
    if (!byAgent[key]) byAgent[key] = { agentEmail: emailById[key] || key, activeDeals: 0, closedDeals: 0, volume: 0, gci: 0 };
    byAgent[key].volume += Number(d.deal_volume) || 0;
    byAgent[key].gci += Number(d.gci) || 0;
    if (d.stage === "closed") byAgent[key].closedDeals++;
    else byAgent[key].activeDeals++;
  }
  return Object.values(byAgent).sort((a, b) => b.volume - a.volume);
}

// One fetch, everything Spark can currently reason about for a brokerage.
export async function getBrokerContext(brokerageId) {
  const [deals, agents, warRoom] = await Promise.all([getDeals(brokerageId), getAgents(brokerageId), getActiveWarRoomStatuses(brokerageId)]);
  const metrics = calculateFirmAggregates(deals);
  const agentVolumes = getAgentDealVolumes(deals, agents);
  return { deals, agents, warRoom, metrics, agentVolumes };
}

function formatContextForPrompt({ metrics, agentVolumes, warRoom }) {
  const agentLines = agentVolumes
    .map((a) => `${a.agentEmail}: $${a.volume.toLocaleString()} volume, $${a.gci.toLocaleString()} GCI, ${a.activeDeals} active, ${a.closedDeals} closed`)
    .join("\n");
  const atRiskLines = metrics.atRiskDeals
    .map((d) => `${d.client_name || "Unnamed"} — $${Number(d.deal_volume).toLocaleString()}, ${d.probability}% probability, status: ${d.status}`)
    .join("; ");
  const warRoomLines = warRoom.map((w) => `${w.deal_name || "Unnamed negotiation"} — stage: ${w.negotiation_stage}`).join("; ");

  return [
    `Total active volume: $${metrics.totalActiveVolume.toLocaleString()}. Pending GCI: $${metrics.pendingGci.toLocaleString()}. Deal velocity: ${metrics.dealVelocity}%.`,
    `Agent breakdown:\n${agentLines || "No agent deal activity recorded."}`,
    `At-risk deals (status at_risk or probability under 50%): ${atRiskLines || "None."}`,
    `Active War Room negotiations: ${warRoomLines || "None."}`,
  ].join("\n\n");
}

// The single entry point both api/ai/broker-copilot.js's text/voice chat
// and any future caller should use — one question in, one grounded,
// in-persona answer out, plus the raw metrics for UI widgets that want
// numbers without round-tripping through the LLM.
export async function answerBrokerQuery(question, brokerageId) {
  const context = await getBrokerContext(brokerageId);
  const contextBlock = formatContextForPrompt(context);

  const prompt = `The broker just asked: "${question}"\n\nHere is the current state of their brokerage (and ONLY their brokerage — never reference or imply data from any other firm):\n\n${contextBlock}\n\nRespond as Spark now.`;

  const generated = await callClaude(prompt, 500);
  const reply = generated || deterministicFallback(context);
  return { reply, context, metrics: context.metrics };
}

// No ANTHROPIC_API_KEY configured — still a genuinely useful, data-grounded
// answer, just templated instead of generated.
function deterministicFallback({ metrics, agentVolumes, warRoom }) {
  const top = agentVolumes[0];
  return (
    `Firm snapshot: $${metrics.totalActiveVolume.toLocaleString()} in active volume, $${metrics.pendingGci.toLocaleString()} pending GCI, ${metrics.dealVelocity}% deal velocity. ` +
    `${top ? `Top volume is ${top.agentEmail} at $${top.volume.toLocaleString()}. ` : ""}` +
    `${metrics.atRiskCount} deal${metrics.atRiskCount === 1 ? " is" : "s are"} at risk. ` +
    `${warRoom.length} active War Room negotiation${warRoom.length === 1 ? "" : "s"} right now.`
  );
}
