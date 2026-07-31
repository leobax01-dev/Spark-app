// src/components/InterventionEngine.jsx — Operations "Intervention Engine"
// tab: a full-screen risk terminal for stalled/at-risk deals, now backed by
// live Supabase data instead of mock rows.
//
// Two adaptations from the literal spec, same reasoning as everywhere else
// in this codebase:
//
// 1. Styling: no Tailwind is configured in this app (no tailwind.config.*),
//    so the requested className strings are kept on every element (harmless
//    now, free upgrade if Tailwind is ever added) and backed by equivalent
//    inline `style` objects tuned to the same dark-glass/neon-alert look.
//
// 2. Supabase client: the spec's `import { supabase } from '../lib/
//    supabaseClient'` doesn't match this app's actual setup — there's no
//    lib/supabaseClient module, and the one unused `src/supabase.js` (a
//    static `createClient` call reading VITE_SUPABASE_URL/KEY at import
//    time) is dead code nothing else imports. Every real Supabase call in
//    this app (BrokerDashboard.jsx, SurveillanceRadar.jsx, App.jsx) instead
//    reads `window.__supabase`, a client lazily created from a CDN import
//    once in App.jsx's mount effect. This follows that same working
//    pattern rather than wiring up a second, parallel client.
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, Tooltip, Scatter,
} from "recharts";
import {
  AlertTriangle, TrendingDown, Clock, Target, Zap, Radar as RadarIcon, User, MapPin, DollarSign, Loader2,
} from "lucide-react";
import SparkBoot from "./SparkBoot";

const RED = "#ff3b5c";
const AMBER = "#ffb020";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

// The brokerage account this terminal is anchored to, per spec — resolved
// to a brokerage_id via a `users` lookup rather than hardcoding an id,
// since the id itself isn't known ahead of time.
const ANCHOR_EMAIL = "team@usesparkai.app";

// `deals` (see supabase/migrations/20260729000000_create_brokerage_suite.sql)
// has no `bottleneck_reason` column — this derives a best-effort, data-driven
// stand-in from the columns that do exist (probability, stage, days since
// last activity) rather than inventing a fake free-text field. Real
// dispatcher/agent-entered bottleneck notes would replace this if that
// column ever lands.
function deriveBottleneckReason(deal, daysStalled) {
  if (deal.status === "at_risk" && deal.probability != null && deal.probability < 35) {
    return `Low close probability (${deal.probability}%) — deal likely needs re-qualification.`;
  }
  if (deal.stage === "contract" && daysStalled > 20) {
    return "Under contract but stalled — likely financing, inspection, or title holdup.";
  }
  if (deal.stage === "prospect") {
    return "Still in prospect stage — no forward momentum since last activity.";
  }
  if (daysStalled > 30) {
    return `No recorded activity in ${daysStalled} days — seller/buyer engagement has gone cold.`;
  }
  return "Elevated risk flagged by pipeline status — cause not yet logged.";
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

function fmtMoney(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = d.status === "AT_RISK" ? RED : AMBER;
  return (
    <div
      style={{
        background: "rgba(5,5,5,0.95)", border: `1px solid ${color}66`, borderRadius: 8,
        padding: "10px 12px", fontFamily: MONO, fontSize: 11, color: "#fff", minWidth: 200,
        boxShadow: `0 0 20px ${color}33`,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4, color }}>{d.status.replace("_", " ")}</div>
      <div style={{ marginBottom: 4, opacity: 0.9 }}>{d.address}</div>
      <div style={{ opacity: 0.7 }}>{fmtMoney(d.volume)} · {d.daysStalled}d stalled</div>
    </div>
  );
}

function MetricCard({ icon: IconCmp, label, value, accent }) {
  return (
    <div
      className="bg-black/40 backdrop-blur-md border border-white/10"
      style={{
        flex: 1, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: "16px 20px",
        boxShadow: `inset 0 0 30px ${accent}0f, 0 0 24px ${accent}1a`,
        display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: accent }}>
        <IconCmp size={14} strokeWidth={2.5} />
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div
        className="drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]"
        style={{
          fontFamily: F, fontSize: 30, fontWeight: 800, color: "#fff",
          textShadow: `0 0 16px ${accent}99`, letterSpacing: -0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RescuePlaybook({ deal }) {
  const steps = [
    {
      title: "Direct Broker-to-Seller Communication",
      body: `Schedule a call with ${deal.agent} within 24h to reset seller expectations around: "${deal.bottleneckReason}".`,
    },
    {
      title: "Micro-Targeted Price Shift",
      body: `Model a 3–5% adjustment on ${deal.address} to re-align with softening sector comps and restore buyer interest.`,
    },
    {
      title: "Re-Engagement Script",
      body: `Redeploy to the VIP whisper network, citing the ${deal.daysStalled}-day stall as urgency leverage for a renewed offer.`,
    },
  ];
  return (
    <div
      className="bg-black/80 font-mono text-xs"
      style={{
        marginTop: 14, background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10, padding: 14, fontFamily: MONO,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#8CA0FF", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
        ▸ AI Rescue Playbook — {String(deal.id).slice(0, 8).toUpperCase()}
      </div>
      {steps.map((s, i) => (
        <div key={i} style={{ marginBottom: i < steps.length - 1 ? 12 : 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", marginBottom: 3 }}>
            {i + 1}. {s.title}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, paddingLeft: 14 }}>
            {s.body}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InterventionEngine() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [playbookReady, setPlaybookReady] = useState(false);

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
            .select("id, agent_id, address, stage, status, deal_volume, gci, probability, last_activity_at")
            .eq("brokerage_id", anchorUser.brokerage_id)
            .in("status", ["at_risk", "stalled"]),
          sb.from("users").select("id, email").eq("brokerage_id", anchorUser.brokerage_id),
        ]);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (cancelled) return;

        const agentById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.email]));

        const mapped = (dealsRes.data || []).map((d) => {
          const volume = Number(d.deal_volume) || 0;
          const daysStalled = daysSince(d.last_activity_at);
          return {
            id: d.id,
            address: d.address || "Address unavailable",
            volume,
            gci: Math.round(volume * 0.03), // per spec — deals.gci is the real commission figure, this mirrors the requested volume*0.03 exposure metric instead
            daysStalled,
            status: d.status === "at_risk" ? "AT_RISK" : "STALLED",
            agent: agentById[d.agent_id] || "Unassigned",
            bottleneckReason: deriveBottleneckReason(d, daysStalled),
          };
        });

        setDeals(mapped);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load intervention feed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const metrics = useMemo(() => {
    const totalVolume = deals.reduce((sum, d) => sum + d.volume, 0);
    const totalGci = deals.reduce((sum, d) => sum + d.gci, 0);
    const avgDays = deals.length ? deals.reduce((sum, d) => sum + d.daysStalled, 0) / deals.length : 0;
    return { totalVolume, totalGci, avgDays };
  }, [deals]);

  function selectDeal(deal) {
    setSelectedDeal(deal);
    setPlaybookReady(false);
    setPlaybookLoading(false);
  }

  function generatePlaybook() {
    setPlaybookLoading(true);
    setPlaybookReady(false);
    setTimeout(() => {
      setPlaybookLoading(false);
      setPlaybookReady(true);
    }, 1400);
  }

  // Centralized SPARK OS loading state — shared pulsing purple bolt
  // splash so every Operations module boots identically.
  if (loading) return <SparkBoot />;

  return (
    <div
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 24, boxSizing: "border-box", overflow: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertTriangle size={20} color={RED} style={{ filter: `drop-shadow(0 0 8px ${RED}aa)` }} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>
            INTERVENTION ENGINE
          </div>
          <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
            {loading ? "Loading live pipeline…" : `Stalled & at-risk deal risk terminal — ${deals.length} active targets`}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            fontFamily: MONO, fontSize: 11.5, color: RED, background: "rgba(255,59,92,0.08)",
            border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}

      {/* Top Telemetry HUD */}
      <div style={{ display: "flex", gap: 14 }}>
        <MetricCard icon={DollarSign} label="Critical Capital at Risk" value={loading ? "…" : fmtMoney(metrics.totalVolume)} accent={RED} />
        <MetricCard icon={TrendingDown} label="GCI Exposure" value={loading ? "…" : fmtMoney(metrics.totalGci)} accent={AMBER} />
        <MetricCard icon={Clock} label="Avg Intervention Window" value={loading ? "…" : `${metrics.avgDays.toFixed(0)}d`} accent="#8CA0FF" />
      </div>

      {/* Main split: Chart (65%) / Action Matrix (35%) */}
      <div style={{ flex: 1, display: "flex", gap: 18, minHeight: 0 }}>
        {/* Left pane — Risk Scatter Plot */}
        <div
          className="bg-black/40 backdrop-blur-md border border-white/10"
          style={{
            flex: "0 0 65%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <RadarIcon size={14} color="rgba(255,255,255,0.5)" />
            <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
              Risk Radar — Days Stalled vs. Deal Volume
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {loading ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
                <Loader2 size={22} color="rgba(255,255,255,0.4)" style={{ animation: "ieSpin 1s linear infinite" }} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>ESTABLISHING SECURE CONNECTION…</span>
                <style>{`@keyframes ieSpin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : deals.length === 0 ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>
                  {error ? "NO DATA — CONNECTION FAILED" : "NO AT-RISK OR STALLED DEALS DETECTED"}
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" />
                  <XAxis
                    type="number" dataKey="daysStalled" name="Days Stalled" unit="d"
                    stroke="rgba(255,255,255,0.25)" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: MONO }}
                    label={{ value: "DAYS STALLED", position: "insideBottom", offset: -6, fill: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: F }}
                  />
                  <YAxis
                    type="number" dataKey="volume" name="Deal Volume"
                    stroke="rgba(255,255,255,0.25)" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: MONO }}
                    tickFormatter={fmtMoney}
                    label={{ value: "DEAL VOLUME", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: F }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Scatter
                    data={deals}
                    cursor="pointer"
                    shape={(props) => {
                      const { cx, cy, payload } = props;
                      const color = payload.status === "AT_RISK" ? RED : AMBER;
                      const isSelected = selectedDeal?.id === payload.id;
                      const r = 6 + Math.min(10, payload.volume / 2_500_000);
                      return (
                        <circle
                          cx={cx} cy={cy} r={isSelected ? r + 3 : r}
                          fill={color} fillOpacity={isSelected ? 1 : 0.75}
                          stroke={isSelected ? "#fff" : "transparent"} strokeWidth={isSelected ? 2 : 0}
                          style={{ filter: `drop-shadow(0 0 6px ${color}aa)`, cursor: "pointer" }}
                          onClick={() => selectDeal(payload)}
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, paddingLeft: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: RED, boxShadow: `0 0 6px ${RED}` }} />
              AT RISK
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: AMBER, boxShadow: `0 0 6px ${AMBER}` }} />
              STALLED
            </div>
          </div>
        </div>

        {/* Right pane — AI Action Matrix */}
        <div
          className="bg-black/40 backdrop-blur-md border border-white/10"
          style={{
            flex: "0 0 35%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18,
            display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto",
          }}
        >
          {!selectedDeal ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
              <div style={{ position: "relative", width: 64, height: 64 }}>
                <div
                  style={{
                    position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(140,160,255,0.4)",
                    animation: "iePulse 2s ease-out infinite",
                  }}
                />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Target size={26} color="#8CA0FF" style={{ filter: "drop-shadow(0 0 8px rgba(140,160,255,0.7))" }} />
                </div>
              </div>
              <div style={{ fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)" }}>
                SELECT TARGET NODE ON RADAR
              </div>
              <div style={{ fontFamily: F, fontSize: 10.5, color: "rgba(255,255,255,0.3)", maxWidth: 220 }}>
                Click any point on the risk scatter plot to lock a target and generate an AI rescue playbook.
              </div>
              <style>{`@keyframes iePulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.6); opacity: 0; } }`}</style>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Target size={14} color={selectedDeal.status === "AT_RISK" ? RED : AMBER} />
                <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: selectedDeal.status === "AT_RISK" ? RED : AMBER, textTransform: "uppercase" }}>
                  Target Locked
                </span>
              </div>

              <div
                style={{
                  border: `1px solid ${selectedDeal.status === "AT_RISK" ? RED : AMBER}44`, borderRadius: 10, padding: 14,
                  background: "rgba(255,255,255,0.02)", boxShadow: `inset 0 0 24px ${selectedDeal.status === "AT_RISK" ? RED : AMBER}0d`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <MapPin size={14} color="rgba(255,255,255,0.5)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                    {selectedDeal.address}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <User size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{selectedDeal.agent}</span>
                </div>

                <div style={{ display: "flex", gap: 20, marginBottom: 12, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div>
                    <div style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 2 }}>Volume</div>
                    <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff" }}>{fmtMoney(selectedDeal.volume)}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 2 }}>Days Stalled</div>
                    <div className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]" style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: RED, textShadow: `0 0 8px ${RED}cc` }}>
                      {selectedDeal.daysStalled}d
                    </div>
                  </div>
                </div>

                <div style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 4 }}>
                  Bottleneck
                </div>
                <div style={{ fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
                  {selectedDeal.bottleneckReason}
                </div>
              </div>

              <button
                onClick={generatePlaybook}
                disabled={playbookLoading}
                style={{
                  width: "100%", marginTop: 14, background: playbookLoading ? "rgba(140,160,255,0.15)" : "linear-gradient(135deg,#4F6BFF,#8CA0FF)",
                  border: "1px solid rgba(140,160,255,0.5)", borderRadius: 10, padding: "12px 14px",
                  fontFamily: F, fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                  color: "#fff", cursor: playbookLoading ? "default" : "pointer",
                  boxShadow: playbookLoading ? "none" : "0 0 20px rgba(140,160,255,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "box-shadow 0.15s ease",
                }}
              >
                {playbookLoading ? (
                  <>
                    <Loader2 size={14} style={{ animation: "ieSpin2 1s linear infinite" }} />
                    Generating…
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Generate AI Rescue Playbook
                  </>
                )}
              </button>
              <style>{`@keyframes ieSpin2 { to { transform: rotate(360deg); } }`}</style>

              {playbookReady && <RescuePlaybook deal={selectedDeal} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
