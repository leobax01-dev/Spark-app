// src/components/PerformanceMatrix.jsx — Operations "Performance Matrix"
// tab: a full-screen agent performance/capacity telemetry terminal, backed
// by live Supabase data (no mock arrays).
//
// Two adaptations from the literal spec, same reasoning as everywhere else
// in this codebase (see InterventionEngine.jsx for the identical rationale
// spelled out in full):
//
// 1. Styling: no Tailwind is configured in this app, so the requested
//    className strings are kept on every element (harmless now, free
//    upgrade if Tailwind is ever added) and backed by equivalent inline
//    `style` objects tuned to the same dark-glass/neon look.
//
// 2. Supabase client: this app has no `lib/supabaseClient` module. Every
//    real Supabase call here (BrokerDashboard.jsx, SurveillanceRadar.jsx,
//    InterventionEngine.jsx, App.jsx) reads `window.__supabase`, a client
//    lazily created from a CDN import once in App.jsx's mount effect —
//    that's the pattern followed below instead of wiring up a second,
//    parallel client against an import path that doesn't exist.
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Legend,
} from "recharts";
import {
  Trophy, Target, Zap, Users, TrendingUp, Loader2, X, Activity,
} from "lucide-react";

const CYAN = "#22d3ee";
const PURPLE = "#a78bfa";
const GREEN = "#22C55E";
const RED = "#ff3b5c";
const AMBER = "#ffb020";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const ANCHOR_EMAIL = "team@usesparkai.app";

const STATUS_COLOR = { ACTIVE: GREEN, "AT RISK": RED, IDLE: "rgba(255,255,255,0.35)" };

function fmtMoney(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function firstName(email) {
  if (!email) return "Unassigned";
  const local = email.split("@")[0];
  return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Builds one row per agent from their raw `deals` rows. `deals` has no
// listing-to-close velocity field, so dealVelocity is derived from
// closing_date - created_at across the agent's closed deals (null when
// they have none yet, rather than faking a number).
function buildAgentMetrics(user, deals) {
  const own = deals.filter((d) => d.agent_id === user.id);
  const active = own.filter((d) => d.stage !== "closed");
  const closed = own.filter((d) => d.stage === "closed");
  const atRisk = own.filter((d) => d.status === "at_risk");

  const activeVolume = active.reduce((sum, d) => sum + (Number(d.deal_volume) || 0), 0);
  const conversionRate = own.length ? (closed.length / own.length) * 100 : 0;

  const velocities = closed
    .map((d) => {
      if (!d.closing_date || !d.created_at) return null;
      const days = (new Date(d.closing_date) - new Date(d.created_at)) / (1000 * 60 * 60 * 24);
      return Number.isFinite(days) && days >= 0 ? days : null;
    })
    .filter((v) => v != null);
  const dealVelocity = velocities.length ? velocities.reduce((s, v) => s + v, 0) / velocities.length : null;

  let status = "IDLE";
  if (atRisk.length > 0) status = "AT RISK";
  else if (active.length > 0) status = "ACTIVE";

  return {
    id: user.id,
    name: firstName(user.email),
    email: user.email,
    activeVolume,
    gci: Math.round(activeVolume * 0.03), // per spec — mirrors the volume-based exposure metric used elsewhere rather than summing deals.gci directly
    activeDeals: active.length,
    conversionRate,
    dealVelocity,
    status,
  };
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(5,5,5,0.95)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
        padding: "10px 12px", fontFamily: MONO, fontSize: 11, color: "#fff", minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtMoney(p.value)}
        </div>
      ))}
    </div>
  );
}

function PodiumCard({ icon: IconCmp, label, name, value, accent }) {
  return (
    <div
      className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4"
      style={{
        flex: 1, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: 16,
        boxShadow: `inset 0 0 30px ${accent}0f, 0 0 24px ${accent}1a`,
        display: "flex", flexDirection: "column", gap: 6, minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: accent }}>
        <IconCmp size={14} strokeWidth={2.5} />
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name || "—"}
      </div>
      <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: accent, textShadow: `0 0 14px ${accent}88` }}>
        {value}
      </div>
    </div>
  );
}

function MetricCard({ icon: IconCmp, label, value, accent }) {
  return (
    <div
      className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4"
      style={{
        flex: 1, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: 16,
        boxShadow: `inset 0 0 30px ${accent}0f, 0 0 24px ${accent}1a`,
        display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: accent }}>
        <IconCmp size={14} strokeWidth={2.5} />
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 28, fontWeight: 800, color: "#fff", textShadow: `0 0 16px ${accent}99`, letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  );
}

function CapacityAudit({ agent, onClose }) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  function run() {
    setLoading(true);
    setReady(false);
    setTimeout(() => {
      setLoading(false);
      setReady(true);
    }, 1200);
  }

  const loadLabel = agent.activeDeals >= 5 ? "over capacity" : agent.activeDeals === 0 ? "under-utilized" : "within normal range";
  const recommendation = agent.activeDeals >= 5
    ? `Redistribute ${Math.max(1, agent.activeDeals - 3)} lower-priority deal(s) to teammates with open capacity to protect close rates on ${agent.name}'s top volume deals.`
    : agent.activeDeals === 0
      ? `${agent.name} has zero active deals — route new inbound leads and stalled deals from over-capacity agents here immediately.`
      : `Current load is sustainable. Maintain lead flow and monitor conversion rate (${agent.conversionRate.toFixed(0)}%) for drift.`;

  return (
    <div
      className="bg-black/40 backdrop-blur-md border border-white/10"
      style={{
        flex: "0 0 35%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18,
        display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 9, letterSpacing: 1.5, color: CYAN, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
            Capacity Audit
          </div>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff" }}>
            AGENT CAPACITY AUDIT: {agent.name}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 0 }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 2 }}>Active Volume</div>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff" }}>{fmtMoney(agent.activeVolume)}</div>
        </div>
        <div>
          <div style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 2 }}>Active Deals</div>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff" }}>{agent.activeDeals}</div>
        </div>
        <div>
          <div style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 2 }}>Conversion</div>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff" }}>{agent.conversionRate.toFixed(0)}%</div>
        </div>
        <div>
          <div style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 2 }}>Velocity</div>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff" }}>{agent.dealVelocity != null ? `${agent.dealVelocity.toFixed(0)}d` : "—"}</div>
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${STATUS_COLOR[agent.status]}44`, borderRadius: 10, padding: 12, marginBottom: 14,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[agent.status], boxShadow: `0 0 6px ${STATUS_COLOR[agent.status]}` }} />
          <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1, color: STATUS_COLOR[agent.status], textTransform: "uppercase" }}>
            Workload: {loadLabel}
          </span>
        </div>
        <div style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{agent.email}</div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        style={{
          width: "100%", background: loading ? "rgba(34,211,238,0.15)" : "linear-gradient(135deg,#22d3ee,#a78bfa)",
          border: "1px solid rgba(34,211,238,0.5)", borderRadius: 10, padding: "12px 14px",
          fontFamily: F, fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
          color: loading ? "#fff" : "#050505", cursor: loading ? "default" : "pointer",
          boxShadow: loading ? "none" : "0 0 20px rgba(34,211,238,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {loading ? (
          <>
            <Loader2 size={14} style={{ animation: "pmSpin 1s linear infinite" }} />
            Analyzing Workload…
          </>
        ) : (
          <>
            <Zap size={14} />
            Run AI Workload Rebalance
          </>
        )}
      </button>
      <style>{`@keyframes pmSpin { to { transform: rotate(360deg); } }`}</style>

      {ready && (
        <div
          className="bg-black/80 font-mono text-xs"
          style={{
            marginTop: 14, background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, padding: 14, fontFamily: MONO,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: CYAN, fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
            ▸ AI Workload Rebalance — {agent.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
            {recommendation}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformanceMatrix() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const sb = window.__supabase;
      if (!sb) {
        if (!cancelled) { setError("Supabase isn't initialized yet — try again in a moment."); setLoading(false); }
        return;
      }

      try {
        const { data: anchorUser, error: anchorError } = await sb
          .from("users")
          .select("id, brokerage_id")
          .eq("email", ANCHOR_EMAIL)
          .maybeSingle();
        if (anchorError) throw new Error(anchorError.message);
        if (!anchorUser?.brokerage_id) throw new Error(`No brokerage found for ${ANCHOR_EMAIL}`);

        const [usersRes, dealsRes] = await Promise.all([
          sb.from("users").select("id, email, role").eq("brokerage_id", anchorUser.brokerage_id),
          sb.from("deals").select("id, agent_id, deal_volume, gci, stage, status, created_at, closing_date").eq("brokerage_id", anchorUser.brokerage_id),
        ]);
        if (usersRes.error) throw new Error(usersRes.error.message);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (cancelled) return;

        const agentUsers = (usersRes.data || []).filter((u) => u.role !== "broker");
        const deals = dealsRes.data || [];
        const built = (agentUsers.length ? agentUsers : usersRes.data || []).map((u) => buildAgentMetrics(u, deals));

        setAgents(built);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load agent telemetry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const hud = useMemo(() => {
    const totalVolume = agents.reduce((sum, a) => sum + a.activeVolume, 0);
    const avgConversion = agents.length ? agents.reduce((sum, a) => sum + a.conversionRate, 0) / agents.length : 0;
    const withVelocity = agents.filter((a) => a.dealVelocity != null);
    const avgVelocity = withVelocity.length ? withVelocity.reduce((sum, a) => sum + a.dealVelocity, 0) / withVelocity.length : null;
    return { totalVolume, avgConversion, avgVelocity };
  }, [agents]);

  const podium = useMemo(() => {
    if (!agents.length) return { topVolume: null, topConversion: null, fastest: null };
    const topVolume = [...agents].sort((a, b) => b.activeVolume - a.activeVolume)[0];
    const topConversion = [...agents].sort((a, b) => b.conversionRate - a.conversionRate)[0];
    const withVelocity = agents.filter((a) => a.dealVelocity != null);
    const fastest = withVelocity.length ? [...withVelocity].sort((a, b) => a.dealVelocity - b.dealVelocity)[0] : null;
    return { topVolume, topConversion, fastest };
  }, [agents]);

  return (
    <div
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6 overflow-y-auto"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 24, boxSizing: "border-box", overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TrendingUp size={20} color={CYAN} style={{ filter: `drop-shadow(0 0 8px ${CYAN}aa)` }} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>PERFORMANCE MATRIX</div>
          <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
            {loading ? "Loading agent telemetry…" : `Brokerage-wide agent performance — ${agents.length} agents tracked`}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px" }}>
          {error}
        </div>
      )}

      {/* Top Section — Podium cards */}
      <div style={{ display: "flex", gap: 14 }}>
        <PodiumCard icon={Trophy} label="Top Volume Producer" name={podium.topVolume?.name} value={podium.topVolume ? fmtMoney(podium.topVolume.activeVolume) : "—"} accent={CYAN} />
        <PodiumCard icon={Target} label="Highest Conversion" name={podium.topConversion?.name} value={podium.topConversion ? `${podium.topConversion.conversionRate.toFixed(0)}%` : "—"} accent={PURPLE} />
        <PodiumCard icon={Zap} label="Fastest Velocity" name={podium.fastest?.name} value={podium.fastest ? `${podium.fastest.dealVelocity.toFixed(0)}d` : "—"} accent={GREEN} />
      </div>

      {/* Top Telemetry HUD */}
      <div style={{ display: "flex", gap: 14 }}>
        <MetricCard icon={Users} label="Brokerage Active Capacity" value={loading ? "…" : fmtMoney(hud.totalVolume)} accent={CYAN} />
        <MetricCard icon={Target} label="Team Conversion Efficiency" value={loading ? "…" : `${hud.avgConversion.toFixed(0)}%`} accent={PURPLE} />
        <MetricCard icon={Activity} label="Mean Deal Velocity" value={loading ? "…" : hud.avgVelocity != null ? `${hud.avgVelocity.toFixed(0)}d` : "—"} accent={AMBER} />
      </div>

      {/* Middle Pane — Volume vs GCI chart */}
      <div
        className="bg-black/40 backdrop-blur-md border border-white/10"
        style={{
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, height: 260, flexShrink: 0,
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 8 }}>
          Agent Volume vs. GCI
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={20} color="rgba(255,255,255,0.4)" style={{ animation: "pmSpin 1s linear infinite" }} />
            </div>
          ) : agents.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>NO AGENT DATA AVAILABLE</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agents} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="pmVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CYAN} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={CYAN} stopOpacity={0.35} />
                  </linearGradient>
                  <linearGradient id="pmGciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PURPLE} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={PURPLE} stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.25)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: F }} />
                <YAxis stroke="rgba(255,255,255,0.25)" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: MONO }} tickFormatter={fmtMoney} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.6)" }} />
                <Bar
                  dataKey="activeVolume" name="Active Volume" fill="url(#pmVolumeGrad)" isAnimationActive={false}
                  shape={(props) => {
                    const { x, y, width, height } = props;
                    return <rect x={x} y={y} width={width} height={height} rx={4} fill="url(#pmVolumeGrad)" style={{ filter: `drop-shadow(0 0 4px ${CYAN}66)` }} />;
                  }}
                />
                <Bar
                  dataKey="gci" name="GCI" fill="url(#pmGciGrad)" isAnimationActive={false}
                  shape={(props) => {
                    const { x, y, width, height } = props;
                    return <rect x={x} y={y} width={width} height={height} rx={4} fill="url(#pmGciGrad)" style={{ filter: `drop-shadow(0 0 4px ${PURPLE}66)` }} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Pane — Telemetry grid + Capacity Audit */}
      <div style={{ flex: 1, display: "flex", gap: 18, minHeight: 320 }}>
        <div
          className="bg-black/40 backdrop-blur-md border border-white/10"
          style={{
            flex: selectedAgent ? "0 0 65%" : "1 1 100%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
          }}
        >
          <div style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 10 }}>
            Agent Telemetry Grid
          </div>

          {/* Column headers */}
          <div
            style={{
              display: "grid", gridTemplateColumns: "1.6fr 0.9fr 1fr 0.8fr 0.8fr", gap: 8, padding: "0 10px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.08)", fontFamily: F, fontSize: 9, fontWeight: 800,
              letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
            }}
          >
            <span>Agent</span>
            <span>Status</span>
            <span>Active Volume</span>
            <span>Conversion</span>
            <span>Velocity</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 20, fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Loading…</div>
            ) : agents.length === 0 ? (
              <div style={{ padding: 20, fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>No agents found for this brokerage.</div>
            ) : (
              agents.map((a) => {
                const active = selectedAgent?.id === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAgent(a)}
                    style={{
                      display: "grid", gridTemplateColumns: "1.6fr 0.9fr 1fr 0.8fr 0.8fr", gap: 8, alignItems: "center",
                      padding: "10px 10px", borderRadius: 8, cursor: "pointer",
                      background: active ? "rgba(34,211,238,0.08)" : "transparent",
                      border: `1px solid ${active ? "rgba(34,211,238,0.35)" : "transparent"}`,
                      transition: "background 0.15s ease, border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.name}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 10, fontWeight: 800, color: STATUS_COLOR[a.status], textTransform: "uppercase" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[a.status], boxShadow: `0 0 6px ${STATUS_COLOR[a.status]}` }} />
                      {a.status}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{fmtMoney(a.activeVolume)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{a.conversionRate.toFixed(0)}%</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{a.dealVelocity != null ? `${a.dealVelocity.toFixed(0)}d` : "—"}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedAgent && <CapacityAudit agent={selectedAgent} onClose={() => setSelectedAgent(null)} />}
      </div>
    </div>
  );
}
