// src/components/ExecutiveOverview.jsx — Operations "Executive Overview"
// tab: a full-screen macro-pipeline telemetry dashboard, backed by live
// Supabase data (no mock arrays).
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
//    InterventionEngine.jsx, PerformanceMatrix.jsx, CommissionLedger.jsx)
//    reads `window.__supabase`, a client lazily created from a CDN import
//    once in App.jsx's mount effect — that's the pattern followed below.
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area,
} from "recharts";
import {
  Activity, DollarSign, Gauge, Zap, RefreshCcw, Loader2, Building2, TrendingUp, TrendingDown, AlertTriangle,
} from "lucide-react";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CYAN = "#22d3ee";
const PURPLE = "#a78bfa";
const GREEN = "#22C55E";
const AMBER = "#ffb020";
const RED = "#ff3b5c";

const ANCHOR_EMAIL = "team@usesparkai.app";

const STAGE_COLOR = { prospect: AMBER, active: CYAN, contract: PURPLE, closed: GREEN };

function fmtMoney(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtRelativeTime(dateStr) {
  if (!dateStr) return "—";
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, (Date.now() - then) / (1000 * 60 * 60 * 24));
}

function firstName(email) {
  if (!email) return "Unassigned";
  const local = email.split("@")[0];
  return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(5,5,5,0.95)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
        padding: "10px 12px", fontFamily: MONO, fontSize: 11, color: "#fff", minWidth: 150,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ color: CYAN }}>Cumulative Volume: {fmtMoney(payload[0].value)}</div>
    </div>
  );
}

// Rule-based portfolio analysis derived straight from the live aggregates —
// not a Claude API call. This mirrors the same simulated-AI convention used
// by InterventionEngine.jsx / PerformanceMatrix.jsx's rescue/rebalance
// outputs, rather than adding a third pattern (a real LLM call, like
// SurveillanceRadar's whisper pitch) for what's fundamentally the same kind
// of "read the numbers, say something useful" feature.
function buildDirectives(deals) {
  if (!deals.length) return ["No active portfolio data available to analyze."];
  const active = deals.filter((d) => d.stage !== "closed");
  const luxuryCount = active.filter((d) => d.volume >= 10_000_000).length;
  const midTierCount = active.filter((d) => d.volume < 5_000_000).length;
  const atRiskCount = active.filter((d) => d.status === "at_risk").length;
  const staleCount = active.filter((d) => (daysSince(d.last_activity_at) ?? 0) > 21).length;
  const avgProbability = active.length ? active.reduce((s, d) => s + (d.probability ?? 50), 0) / active.length : 0;

  const directives = [];
  if (luxuryCount / Math.max(active.length, 1) > 0.4) {
    directives.push(`Portfolio concentration heavy in luxury sector (${luxuryCount} deals $10M+). Recommendation: deploy re-engagement campaigns for mid-tier inventory to diversify exposure.`);
  } else if (midTierCount / Math.max(active.length, 1) > 0.6) {
    directives.push(`Pipeline weighted toward sub-$5M inventory (${midTierCount} of ${active.length} active). Recommendation: prioritize agent bandwidth on high-GCI luxury prospects.`);
  }
  if (atRiskCount > 0) {
    directives.push(`${atRiskCount} deal${atRiskCount === 1 ? "" : "s"} flagged at-risk brokerage-wide. Recommendation: route to Intervention Engine for rescue playbook generation.`);
  }
  if (staleCount > 0) {
    directives.push(`${staleCount} active deal${staleCount === 1 ? "" : "s"} with no activity in 21+ days. Recommendation: trigger agent check-ins to restore momentum.`);
  }
  if (avgProbability < 45 && active.length) {
    directives.push(`Average close probability sitting at ${avgProbability.toFixed(0)}% — below healthy threshold. Recommendation: audit pricing strategy across the active pipeline.`);
  }
  if (!directives.length) {
    directives.push("Portfolio health is nominal — no elevated concentration, staleness, or risk signals detected this cycle.");
  }
  return directives;
}

export default function ExecutiveOverview() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [directivesRefreshing, setDirectivesRefreshing] = useState(false);
  const [directivesVersion, setDirectivesVersion] = useState(0);

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

        const [dealsRes, usersRes] = await Promise.all([
          sb
            .from("deals")
            .select("id, agent_id, client_name, address, stage, status, deal_volume, probability, last_activity_at, created_at, updated_at")
            .eq("brokerage_id", anchorUser.brokerage_id)
            .order("created_at", { ascending: true }),
          sb.from("users").select("id, email").eq("brokerage_id", anchorUser.brokerage_id),
        ]);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (usersRes.error) throw new Error(usersRes.error.message);
        if (cancelled) return;

        const emailById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.email]));
        const mapped = (dealsRes.data || []).map((d) => ({
          id: d.id,
          agent: firstName(emailById[d.agent_id]),
          address: d.address || "Address unavailable",
          stage: d.stage,
          status: d.status,
          volume: Number(d.deal_volume) || 0,
          gci: Math.round((Number(d.deal_volume) || 0) * 0.03), // per spec — mirrors the volume-based GCI metric used across every other Operations tab
          probability: d.probability != null ? Number(d.probability) : null,
          last_activity_at: d.last_activity_at,
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));

        setDeals(mapped);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load macro-pipeline telemetry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const hud = useMemo(() => {
    const active = deals.filter((d) => d.stage !== "closed");
    const totalActiveVolume = active.reduce((sum, d) => sum + d.volume, 0);
    const pendingGci = deals
      .filter((d) => d.stage === "prospect" || d.stage === "active" || d.stage === "contract")
      .reduce((sum, d) => sum + d.gci, 0);

    // "Deal Velocity Index" — no explicit timeline-efficiency column exists
    // on `deals`, so this derives a 0-100 score from how recently the
    // active pipeline has seen activity (faster/fresher activity -> higher
    // index) rather than inventing an unrelated stored metric.
    const withActivity = active.filter((d) => d.last_activity_at);
    const avgDaysSinceActivity = withActivity.length
      ? withActivity.reduce((sum, d) => sum + (daysSince(d.last_activity_at) || 0), 0) / withActivity.length
      : null;
    const velocityIndex = avgDaysSinceActivity != null ? Math.max(0, Math.min(100, Math.round(100 - avgDaysSinceActivity * 2))) : null;

    return { totalActiveVolume, pendingGci, velocityIndex, activeCount: active.length };
  }, [deals]);

  const chartData = useMemo(() => {
    let cumulative = 0;
    return deals.map((d) => {
      cumulative += d.volume;
      return {
        date: d.created_at ? new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—",
        volume: cumulative,
      };
    });
  }, [deals]);

  const directives = useMemo(() => buildDirectives(deals), [deals, directivesVersion]);

  const activityFeed = useMemo(() => {
    return [...deals]
      .sort((a, b) => new Date(b.updated_at || b.last_activity_at || 0) - new Date(a.updated_at || a.last_activity_at || 0))
      .slice(0, 12);
  }, [deals]);

  function refreshDirectives() {
    setDirectivesRefreshing(true);
    setTimeout(() => {
      setDirectivesVersion((v) => v + 1);
      setDirectivesRefreshing(false);
    }, 900);
  }

  return (
    <div
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6 overflow-y-auto"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 20, boxSizing: "border-box", overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Building2 size={20} color={CYAN} style={{ filter: `drop-shadow(0 0 8px ${CYAN}aa)` }} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>EXECUTIVE OVERVIEW</div>
          <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
            {loading ? "Loading macro-pipeline telemetry…" : `Brokerage macro pipeline — ${hud.activeCount} active properties tracked`}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px" }}>
          {error}
        </div>
      )}

      {/* Top Macro-Pipeline HUD */}
      <div style={{ display: "flex", gap: 14 }}>
        <MetricCard icon={DollarSign} label="Total Active Volume" value={loading ? "…" : fmtMoney(hud.totalActiveVolume)} accent={CYAN} />
        <MetricCard icon={Activity} label="Pending GCI" value={loading ? "…" : fmtMoney(hud.pendingGci)} accent={GREEN} />
        <MetricCard icon={Gauge} label="Deal Velocity Index" value={loading ? "…" : hud.velocityIndex != null ? `${hud.velocityIndex}` : "—"} accent={PURPLE} />
      </div>

      {/* Middle Pane — Macro Portfolio Trend */}
      <div
        className="bg-black/40 backdrop-blur-md border border-white/10"
        style={{
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, height: 260, flexShrink: 0,
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 8 }}>
          Macro Portfolio Trend — Cumulative Volume
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={20} color="rgba(255,255,255,0.4)" style={{ animation: "eoSpin 1s linear infinite" }} />
              <style>{`@keyframes eoSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>NO PORTFOLIO DATA AVAILABLE</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="eoVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CYAN} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={PURPLE} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.25)" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: MONO }} />
                <YAxis stroke="rgba(255,255,255,0.25)" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: MONO }} tickFormatter={fmtMoney} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }} />
                <Area
                  type="monotone" dataKey="volume" stroke={CYAN} strokeWidth={2} fill="url(#eoVolumeGrad)"
                  isAnimationActive={false}
                  dot={{ r: 2, fill: CYAN, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Pane — AI Capital Directives / Live Activity Feed */}
      <div style={{ flex: 1, display: "flex", gap: 18, minHeight: 300 }}>
        {/* AI Capital Directives */}
        <div
          className="bg-black/40 backdrop-blur-md border border-white/10"
          style={{
            flex: "0 0 55%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={14} color={PURPLE} />
              <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
                AI Capital Directives
              </span>
            </div>
            <button
              onClick={refreshDirectives}
              disabled={directivesRefreshing || loading}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "rgba(167,139,250,0.12)",
                border: `1px solid ${PURPLE}55`, borderRadius: 8, color: PURPLE, fontFamily: F, fontSize: 9.5,
                fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", padding: "7px 12px",
                cursor: directivesRefreshing || loading ? "default" : "pointer",
                boxShadow: directivesRefreshing ? "none" : `0 0 14px ${PURPLE}33`,
                opacity: loading ? 0.5 : 1,
              }}
            >
              <RefreshCcw size={12} style={directivesRefreshing ? { animation: "eoSpin 1s linear infinite" } : undefined} />
              Refresh Directives
            </button>
          </div>

          <div
            className="bg-black/80 font-mono text-xs"
            style={{
              flex: 1, background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10, padding: 14, fontFamily: MONO, overflowY: "auto",
            }}
          >
            {directivesRefreshing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                <Loader2 size={13} style={{ animation: "eoSpin 1s linear infinite" }} />
                Re-analyzing portfolio…
              </div>
            ) : (
              directives.map((text, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < directives.length - 1 ? 12 : 0 }}>
                  {text.toLowerCase().includes("at-risk") || text.toLowerCase().includes("below healthy") ? (
                    <AlertTriangle size={13} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : text.toLowerCase().includes("nominal") ? (
                    <TrendingUp size={13} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : (
                    <TrendingDown size={13} color={AMBER} style={{ flexShrink: 0, marginTop: 1 }} />
                  )}
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Brokerage Activity Feed */}
        <div
          className="bg-black/40 backdrop-blur-md border border-white/10"
          style={{
            flex: "0 0 45%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
            <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
              Live Brokerage Activity
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>Loading feed…</div>
            ) : activityFeed.length === 0 ? (
              <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "8px 0" }}>No recent activity recorded.</div>
            ) : (
              activityFeed.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 4, flexShrink: 0, background: STAGE_COLOR[d.stage] || "rgba(255,255,255,0.3)", boxShadow: `0 0 6px ${STAGE_COLOR[d.stage] || "transparent"}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F, fontSize: 11.5, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong>{d.agent}</strong> · {d.address}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                      {d.stage} · {fmtMoney(d.volume)} · {fmtRelativeTime(d.updated_at || d.last_activity_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
