// src/components/PerformanceMatrix.jsx — SPARK OS Agent Alpha & Production
// Intelligence Terminal. Live Supabase `deals` telemetry is grouped per
// agent into a predictive 6-card HUD, a multi-axis production visualizer, a
// tactical leaderboard with an Alpha Dossier drawer, and a brokerage-wide
// conversion funnel.
//
// Standing adaptations, same rationale as every other Operations-suite file:
//
// 1. Styling: no Tailwind is configured in this app — requested className
//    strings are kept (free upgrade if Tailwind ever lands) and backed by
//    equivalent inline styles.
//
// 2. Supabase client: this app's working client is `window.__supabase`
//    (lazily CDN-created in App.jsx); there is no lib/supabaseClient module.
//
// 3. Recharts animation: this app's recharts build never resolves its enter
//    animation in some embedded/throttled contexts, leaving series blank —
//    every chart here sets isAnimationActive={false}, same as the other
//    Operations modules.
//
// 4. Demo fallback: when the desk has fewer than MIN_AGENTS real producers,
//    the terminal synthesizes additional agents scaled off the real volume
//    context so a demo doesn't show an empty grid. Synthesized rows are
//    explicitly badged SIM and the header carries a SIMULATED DESK warning —
//    a broker must never mistake generated production for booked production.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line,
  AreaChart, Area,
} from "recharts";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Trophy, Target, Zap, Users, TrendingUp, Gauge, Timer, ShieldAlert,
  Loader2, X, Send, ArrowRight, Crown,
} from "lucide-react";
import SparkBoot from "./SparkBoot";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const PURPLE = "#a855f7";
const PURPLE_LT = "#c084fc";
const CYAN = "#22d3ee";
const GREEN = "#22C55E";
const AMBER = "#ffb020";
const RED = "#ff3b5c";
const GOLD = "#fbbf24";
const SILVER = "#cbd5e1";
const BRONZE = "#d97706";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const ANCHOR_EMAIL = "team@usesparkai.app";
const MIN_AGENTS = 4;

const STATUS = {
  PEAK: { label: "Peak Alpha", color: GREEN },
  ACTIVE: { label: "Active", color: CYAN },
  FLIGHT: { label: "Flight Risk", color: RED },
  IDLE: { label: "Idle", color: SLATE_DIM },
};

const VIEWS = [
  { id: "volume", label: "[ Volume vs GCI ]" },
  { id: "velocity", label: "[ Deal Velocity (DOM) ]" },
  { id: "conversion", label: "[ Conversion Efficiency ]" },
];

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d = (new Date(b) - new Date(a)) / 86400000;
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function daysSince(d) {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 86400000) : null;
}

function firstName(email) {
  if (!email) return "Unassigned";
  return email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Animated ticker ───────────────────────────────────────────────────────
function Ticker({ value, format }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, value || 0, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

// NOTE: no framer-motion entrance animation on this card (or on the
// leaderboard rows below). Staggered opacity entrances do not reliably
// complete in embedded/throttled contexts — cards past the first two stay
// frozen at partial opacity, i.e. the broker silently loses metrics. The
// count-up Ticker still animates because its value drives text, not
// visibility. Content must never be gated behind an animation completing.
function MetricCard({ icon: IconCmp, label, primary, value, format, accent, badge, badgeColor, spark, i = 0 }) {
  const gid = `pmSpark-${label.replace(/[^a-z]/gi, "")}`;
  return (
    <div
      className="backdrop-blur-2xl bg-black/60 border border-white/10 rounded-xl p-4"
      style={{
        flex: 1, position: "relative", overflow: "hidden", minWidth: 0,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: 14,
        boxShadow: `inset 0 0 30px ${accent}0d, 0 0 20px ${accent}12`,
        display: "flex", flexDirection: "column", gap: 5,
      }}
    >
      {spark?.length > 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: 0.24, pointerEvents: "none" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 26, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.2} fill={`url(#${gid})`} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: accent, position: "relative" }}>
        <IconCmp size={12} strokeWidth={2.5} />
        <span className="tracking-wider" style={{ fontFamily: F, fontSize: 8, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      {primary && (
        <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#fff", position: "relative", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{primary}</div>
      )}
      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: "#fff", textShadow: `0 0 14px ${accent}88`, letterSpacing: -0.4, position: "relative", whiteSpace: "nowrap" }}>
        <Ticker value={value} format={format} />
      </div>
      {badge && (
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, color: badgeColor, textShadow: `0 0 9px ${badgeColor}77`, position: "relative" }}>
          {badge}
        </div>
      )}
    </div>
  );
}

function GlassTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const a = payload[0].payload;
  const rows = [
    ["VOLUME", fmtMoney(a.activeVolume)],
    ["GCI", fmtMoney(a.gci)],
    ["AVG DOM", a.avgDom != null ? `${Math.round(a.avgDom)}d` : "—"],
    ["ACTIVE TARGETS", String(a.activeDeals)],
    ["CLOSE RATE", `${a.closeRate.toFixed(0)}%`],
  ];
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      background: "rgba(4,4,8,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${PURPLE}55`, borderRadius: 10, padding: "10px 13px",
      fontFamily: MONO, fontSize: 10.5, color: "#fff", minWidth: 205, boxShadow: `0 0 24px ${PURPLE}33`,
    }}>
      <div style={{ fontWeight: 800, marginBottom: 6, letterSpacing: 1, color: PURPLE_LT }}>{a.name.toUpperCase()}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ color: SLATE_DIM }}>{k}</span><span>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── AI coaching directive ─────────────────────────────────────────────────
function buildCoaching(a) {
  const lines = [`AGENT: ${a.name.toUpperCase()} · DESK RANK #${a.rank}`, ``];
  if (a.status === "FLIGHT") {
    lines.push(`RETENTION ALERT — production decay detected.`,
      `Avg DOM of ${Math.round(a.avgDom ?? 0)}d runs ${Math.round((a.avgDom ?? 0) - a.deskAvgDom)}d over desk average and close rate sits at ${a.closeRate.toFixed(0)}%.`,
      `ACTION: schedule a 1:1 inside 48h. Audit the ${a.stalledCount} dormant file(s) before reassigning any inventory.`);
  } else if (a.status === "PEAK") {
    lines.push(`PEAK ALPHA — this desk seat is compounding.`,
      `${fmtMoney(a.activeVolume)} active against a ${a.closeRate.toFixed(0)}% close rate and ${Math.round(a.avgDom ?? 0)}d avg DOM.`,
      `ACTION: route premium inbound here first. Protect capacity — do not exceed ${a.activeDeals + 2} concurrent files.`);
  } else if (a.status === "IDLE") {
    lines.push(`UNDER-UTILIZED — zero active inventory on this seat.`,
      `ACTION: assign 2-3 files from over-capacity producers this week and re-baseline in 30 days.`);
  } else {
    lines.push(`STABLE PRODUCTION — within desk tolerances.`,
      `Close rate ${a.closeRate.toFixed(0)}% vs desk ${a.deskCloseRate.toFixed(0)}%; DOM ${Math.round(a.avgDom ?? 0)}d vs desk ${Math.round(a.deskAvgDom)}d.`,
      `ACTION: hold lead flow steady and monitor DOM drift over the next two cycles.`);
  }
  lines.push(``, `GCI YIELD: ${fmtMoney(a.gciPerDeal)} per file · PIPELINE ${a.prospect}P / ${a.active}A / ${a.contract}C`);
  return lines.join("\n");
}

// ── Demo-safe synthesizer ─────────────────────────────────────────────────
// Scales generated producers off the real desk's volume context so the
// terminal reads as a populated brokerage instead of an empty grid.
const SYNTH_NAMES = ["M. Torres", "J. Whitfield", "R. Chen", "A. Delacroix", "K. Osei", "S. Barrington"];
function synthesizeAgents(real, deskVolume) {
  const base = deskVolume > 0 ? deskVolume / Math.max(real.length, 1) : 6_400_000;
  const taken = new Set(real.map((r) => r.name.toLowerCase()));
  const out = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (const name of SYNTH_NAMES) {
    if (real.length + out.length >= MIN_AGENTS + 2) break;
    if (taken.has(name.toLowerCase())) continue;
    const mult = 0.42 + rnd() * 1.5;
    const activeDeals = 1 + Math.floor(rnd() * 5);
    const total = activeDeals + 1 + Math.floor(rnd() * 4);
    const closed = total - activeDeals;
    const activeVolume = Math.round((base * mult) / 50_000) * 50_000;
    out.push({
      id: `sim-${name}`, name, email: "", synthetic: true,
      activeVolume, gci: Math.round(activeVolume * 0.03),
      activeDeals, total, closed,
      closeRate: total ? (closed / total) * 100 : 0,
      avgDom: 22 + rnd() * 58,
      prospect: Math.max(0, activeDeals - 2), active: Math.min(activeDeals, 2),
      contract: Math.max(0, activeDeals - Math.min(activeDeals, 2) - Math.max(0, activeDeals - 2)),
      stalledCount: rnd() > 0.62 ? 1 + Math.floor(rnd() * 2) : 0,
      prospectToClose: 48 + rnd() * 70,
    });
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function PerformanceMatrix({ user, onNavigate }) {
  const [deals, setDeals] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("volume");
  const [selected, setSelected] = useState(null);
  const [coach, setCoach] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [toast, setToast] = useState(null);
  const decryptTimer = useRef(null);

  useEffect(() => { setCoach(null); setDecrypting(false); if (decryptTimer.current) clearInterval(decryptTimer.current); }, [selected?.id]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = window.__supabase;
      if (!sb) { if (!cancelled) { setError("Supabase isn't initialized yet — try again in a moment."); setLoading(false); } return; }
      try {
        const { data: anchor, error: aErr } = await sb.from("users").select("id, brokerage_id").eq("email", ANCHOR_EMAIL).maybeSingle();
        if (aErr) throw new Error(aErr.message);
        if (!anchor?.brokerage_id) throw new Error(`No brokerage found for ${ANCHOR_EMAIL}`);
        const [dealsRes, usersRes] = await Promise.all([
          sb.from("deals").select("id, agent_id, address, stage, status, deal_volume, probability, created_at, closing_date, last_activity_at").eq("brokerage_id", anchor.brokerage_id),
          sb.from("users").select("id, email, role").eq("brokerage_id", anchor.brokerage_id),
        ]);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (usersRes.error) throw new Error(usersRes.error.message);
        if (cancelled) return;
        setDeals(dealsRes.data || []);
        setUsers(usersRes.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load agent telemetry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Per-agent aggregation via reduce ───────────────────────────────────
  const { agents, synthesized } = useMemo(() => {
    const roster = users.filter((u) => u.role !== "broker");
    const pool = roster.length ? roster : users;

    const real = pool.map((u) => {
      const own = deals.filter((d) => d.agent_id === u.id);
      const closed = own.filter((d) => d.stage === "closed");
      const activeSet = own.filter((d) => d.stage !== "closed");
      const activeVolume = activeSet.reduce((s, d) => s + (Number(d.deal_volume) || 0), 0);
      const doms = closed.map((d) => daysBetween(d.created_at, d.closing_date)).filter((v) => v != null);
      const p2c = doms.length ? doms.reduce((s, v) => s + v, 0) / doms.length : null;
      return {
        id: u.id, name: firstName(u.email), email: u.email, synthetic: false,
        activeVolume, gci: Math.round(activeVolume * 0.03),
        activeDeals: activeSet.length, total: own.length, closed: closed.length,
        closeRate: own.length ? (closed.length / own.length) * 100 : 0,
        avgDom: p2c,
        prospect: own.filter((d) => d.stage === "prospect").length,
        active: own.filter((d) => d.stage === "active").length,
        contract: own.filter((d) => d.stage === "contract").length,
        stalledCount: activeSet.filter((d) => (daysSince(d.last_activity_at) ?? 0) > 21).length,
        prospectToClose: p2c,
      };
    });

    const deskVolume = real.reduce((s, a) => s + a.activeVolume, 0);
    const withData = real.filter((a) => a.total > 0);
    const needsFallback = withData.length < MIN_AGENTS;
    const merged = needsFallback ? [...real, ...synthesizeAgents(real, deskVolume)] : real;

    // Desk baselines for status classification
    const domVals = merged.map((a) => a.avgDom).filter((v) => v != null);
    const deskAvgDom = domVals.length ? domVals.reduce((s, v) => s + v, 0) / domVals.length : 0;
    const deskCloseRate = merged.length ? merged.reduce((s, a) => s + a.closeRate, 0) / merged.length : 0;

    const ranked = [...merged]
      .sort((a, b) => b.activeVolume - a.activeVolume)
      .map((a, i) => {
        let status = "ACTIVE";
        if (a.activeDeals === 0 && a.total === 0) status = "IDLE";
        else if (a.stalledCount >= 2 || (a.avgDom != null && a.avgDom > deskAvgDom * 1.35 && a.closeRate < deskCloseRate)) status = "FLIGHT";
        else if (i === 0 || (a.closeRate >= deskCloseRate && a.activeVolume >= (deskVolume / Math.max(merged.length, 1)))) status = "PEAK";
        return {
          ...a, rank: i + 1, status, deskAvgDom, deskCloseRate,
          gciPerDeal: a.total ? a.gci / a.total : 0,
        };
      });

    return { agents: ranked, synthesized: needsFallback };
  }, [deals, users]);

  // ── HUD math ───────────────────────────────────────────────────────────
  const hud = useMemo(() => {
    if (!agents.length) return null;
    const byVol = [...agents].sort((a, b) => b.activeVolume - a.activeVolume);
    const byConv = [...agents].sort((a, b) => b.closeRate - a.closeRate);
    const withDom = agents.filter((a) => a.avgDom != null);
    const byDom = [...withDom].sort((a, b) => a.avgDom - b.avgDom);

    const totalGci = agents.reduce((s, a) => s + a.gci, 0);
    // Concentration risk: share of GCI produced by the top 20% of the desk
    const topN = Math.max(1, Math.ceil(agents.length * 0.2));
    const topGci = [...agents].sort((a, b) => b.gci - a.gci).slice(0, topN).reduce((s, a) => s + a.gci, 0);
    const concentration = totalGci > 0 ? (topGci / totalGci) * 100 : 0;

    const p2cVals = agents.map((a) => a.prospectToClose).filter((v) => v != null);
    const burn = p2cVals.length ? p2cVals.reduce((s, v) => s + v, 0) / p2cVals.length : null;

    return {
      topProducer: byVol[0], topConverter: byConv[0], fastest: byDom[0] || null,
      concentration, avgGci: totalGci / agents.length, burn, topN,
    };
  }, [agents]);

  const spark = useMemo(() => {
    let cum = 0;
    return [...agents].reverse().map((a) => { cum += a.activeVolume; return { v: cum }; });
  }, [agents]);

  const chartData = useMemo(() => agents.map((a) => ({
    ...a,
    domValue: a.avgDom ?? 0,
    gciYield: a.gciPerDeal,
  })), [agents]);

  // ── Brokerage funnel ───────────────────────────────────────────────────
  const funnel = useMemo(() => {
    const stage = (s) => deals.filter((d) => d.stage === s).length;
    const p = stage("prospect"), a = stage("active"), c = stage("contract"), cl = stage("closed");
    const useSynth = synthesized && deals.length < 4;
    const nodes = useSynth
      ? [{ k: "PROSPECT", v: 24 }, { k: "ACTIVE LISTING", v: 17 }, { k: "IN CONTRACT", v: 11 }, { k: "CLOSED", v: 8 }]
      : [{ k: "PROSPECT", v: p }, { k: "ACTIVE LISTING", v: a }, { k: "IN CONTRACT", v: c }, { k: "CLOSED", v: cl }];
    const max = Math.max(...nodes.map((n) => n.v), 1);
    return nodes.map((n, i) => ({
      ...n,
      pct: (n.v / max) * 100,
      conv: i === 0 ? null : nodes[i - 1].v > 0 ? (n.v / nodes[i - 1].v) * 100 : 0,
    }));
  }, [deals, synthesized]);

  const generateCoaching = useCallback(() => {
    if (!selected || decrypting) return;
    const full = buildCoaching(selected);
    setDecrypting(true); setCoach("");
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let frame = 0; const total = 30;
    decryptTimer.current = setInterval(() => {
      frame += 1;
      const reveal = Math.floor((frame / total) * full.length);
      let out = full.slice(0, reveal);
      for (let i = 0; i < Math.min(14, full.length - reveal); i++) out += chars[Math.floor(Math.random() * chars.length)];
      setCoach(out);
      if (frame >= total) { clearInterval(decryptTimer.current); setCoach(full); setDecrypting(false); }
    }, 38);
  }, [selected, decrypting]);

  const dispatchCoaching = useCallback(() => {
    if (!selected) return;
    const subject = `SPARK OS: Coaching Directive for ${selected.name}`;
    const body = [
      `Agent: ${selected.name} · Desk rank #${selected.rank}`,
      `Active volume: ${fmtMoney(selected.activeVolume)} · Pending GCI: ${fmtMoney(selected.gci)}`,
      `Close rate: ${selected.closeRate.toFixed(0)}% · Avg DOM: ${selected.avgDom != null ? Math.round(selected.avgDom) + "d" : "—"}`,
      ``, `--- AI COACHING DIRECTIVE ---`,
      coach && !decrypting ? coach : buildCoaching(selected),
      ``, `Generated by SPARK OS Real Estate AI — Performance Matrix`,
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(selected.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setToast(`Coaching script drafted for ${selected.name}.`);
  }, [selected, coach, decrypting]);

  if (loading) return <SparkBoot label="ANALYZING BROKERAGE ALPHA & PRODUCTION METRICS..." />;

  return (
    <div
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6 overflow-y-auto"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 16, boxSizing: "border-box", overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes pmBlink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes pmSpin{to{transform:rotate(360deg)}}
      `}</style>

      {toast && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 60,
            background: "rgba(6,6,12,0.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "11px 20px", color: "#fff",
            fontFamily: F, fontSize: 12, fontWeight: 700, boxShadow: `0 0 26px ${PURPLE}55`, whiteSpace: "nowrap",
          }}>{toast}</motion.div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TrendingUp size={20} color={PURPLE_LT} style={{ filter: `drop-shadow(0 0 8px ${PURPLE}aa)` }} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1.4, color: "#fff" }}>PERFORMANCE MATRIX</div>
          <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, color: SLATE_DIM, letterSpacing: 2 }}>
            AGENT ALPHA &amp; PRODUCTION INTELLIGENCE — {agents.length} SEATS TRACKED
          </div>
        </div>
        {synthesized && (
          <span className="font-mono" style={{
            marginLeft: "auto", fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2,
            color: AMBER, background: `${AMBER}14`, border: `1px solid ${AMBER}66`, borderRadius: 999,
            padding: "5px 12px", boxShadow: `0 0 12px ${AMBER}33`,
          }}>
            ⚠ SIMULATED DESK · SPARSE LIVE DATA
          </span>
        )}
      </div>

      {error && (
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px" }}>{error}</div>
      )}

      {/* 6-card Predictive HUD */}
      {hud && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 11 }}>
          <MetricCard i={0} icon={Trophy} label="Top Volume Producer" primary={hud.topProducer.name}
            value={hud.topProducer.activeVolume} format={fmtMoney} accent={GOLD} spark={spark}
            badge={`#1 OF ${agents.length} SEATS`} badgeColor={GOLD} />
          <MetricCard i={1} icon={Target} label="Highest Conversion" primary={hud.topConverter.name}
            value={hud.topConverter.closeRate} format={(v) => `${v.toFixed(0)}%`} accent={GREEN} spark={spark}
            badge={`+${(hud.topConverter.closeRate - hud.topConverter.deskCloseRate).toFixed(0)}% VS DESK`} badgeColor={GREEN} />
          <MetricCard i={2} icon={Timer} label="Fastest Deal Velocity" primary={hud.fastest?.name || "—"}
            value={hud.fastest?.avgDom ?? 0} format={(v) => `${Math.round(v)}d`} accent={CYAN} spark={spark}
            badge="LOWEST AVG DOM" badgeColor={CYAN} />
          <MetricCard i={3} icon={ShieldAlert} label="Concentration Risk" value={hud.concentration}
            format={(v) => `${v.toFixed(0)}%`} accent={hud.concentration > 60 ? RED : AMBER} spark={spark}
            badge={hud.concentration > 60 ? `⚠ TOP ${hud.topN} DRIVE MAJORITY` : `TOP ${hud.topN} OF DESK GCI`}
            badgeColor={hud.concentration > 60 ? RED : AMBER} />
          <MetricCard i={4} icon={Users} label="Avg GCI / Producer" value={hud.avgGci} format={fmtMoney}
            accent={PURPLE} spark={spark} badge="DESK AVERAGE RETURN" badgeColor={PURPLE_LT} />
          <MetricCard i={5} icon={Gauge} label="Pipeline Burn Rate" value={hud.burn ?? 0}
            format={(v) => (hud.burn == null ? "—" : `${Math.round(v)}d`)} accent={AMBER} spark={spark}
            badge="PROSPECT → CLOSE" badgeColor={AMBER} />
        </div>
      )}

      {/* Composed production analytics */}
      <div
        className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, height: 300, flexShrink: 0,
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
            Production Analytics
          </span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => setView(v.id)}
                className="font-mono"
                style={{
                  fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.8, padding: "6px 11px",
                  borderRadius: 7, cursor: "pointer", textTransform: "uppercase",
                  background: view === v.id ? `${PURPLE}22` : "transparent",
                  border: `1px solid ${view === v.id ? PURPLE : "rgba(255,255,255,0.12)"}`,
                  color: view === v.id ? PURPLE_LT : SLATE_DIM,
                  boxShadow: view === v.id ? `0 0 12px ${PURPLE}44` : "none",
                }}>{v.label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {chartData.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: SLATE_DIM }}>NO AGENT DATA AVAILABLE</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="pmBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PURPLE} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={CYAN} stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.22)" tick={{ fill: SLATE_DIM, fontSize: 9.5, fontFamily: F }} />
                <YAxis yAxisId="l" stroke="rgba(255,255,255,0.22)" tick={{ fill: SLATE_DIM, fontSize: 9.5, fontFamily: MONO }}
                  tickFormatter={view === "volume" ? fmtMoney : view === "velocity" ? (v) => `${Math.round(v)}d` : (v) => `${Math.round(v)}%`} />
                <YAxis yAxisId="r" orientation="right" stroke="rgba(255,255,255,0.14)" tick={{ fill: "rgba(148,163,184,0.45)", fontSize: 9, fontFamily: MONO }}
                  tickFormatter={view === "volume" ? fmtMoney : (v) => `${Math.round(v)}`} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                {view === "volume" && <>
                  <Bar yAxisId="l" dataKey="activeVolume" name="Active Volume" isAnimationActive={false} radius={[4, 4, 0, 0]}
                    shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={4} fill="url(#pmBar)" style={{ filter: `drop-shadow(0 0 6px ${PURPLE}55)` }} />} />
                  <Line yAxisId="r" type="monotone" dataKey="gciYield" name="GCI / Deal" stroke={PURPLE_LT} strokeWidth={2}
                    isAnimationActive={false} dot={{ r: 3, fill: PURPLE_LT, strokeWidth: 0 }} />
                </>}
                {view === "velocity" && <>
                  <Bar yAxisId="l" dataKey="domValue" name="Avg DOM" isAnimationActive={false} radius={[4, 4, 0, 0]}
                    shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={4} fill="url(#pmBar)" style={{ filter: `drop-shadow(0 0 6px ${CYAN}55)` }} />} />
                  <Line yAxisId="r" type="monotone" dataKey="activeDeals" name="Active Files" stroke={CYAN} strokeWidth={2}
                    isAnimationActive={false} dot={{ r: 3, fill: CYAN, strokeWidth: 0 }} />
                </>}
                {view === "conversion" && <>
                  <Bar yAxisId="l" dataKey="closeRate" name="Close Rate" isAnimationActive={false} radius={[4, 4, 0, 0]}
                    shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={4} fill="url(#pmBar)" style={{ filter: `drop-shadow(0 0 6px ${GREEN}55)` }} />} />
                  <Line yAxisId="r" type="monotone" dataKey="total" name="Total Files" stroke={GREEN} strokeWidth={2}
                    isAnimationActive={false} dot={{ r: 3, fill: GREEN, strokeWidth: 0 }} />
                </>}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Brokerage funnel */}
      <div
        className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, flexShrink: 0,
        }}
      >
        <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 12 }}>
          Brokerage Pipeline Funnel &amp; Retention Matrix
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {funnel.map((n, i) => (
            <div key={n.k} style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tracking-wider" style={{ fontFamily: F, fontSize: 8, fontWeight: 800, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 6 }}>{n.k}</div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: "#fff", textShadow: `0 0 14px ${PURPLE}66`, marginBottom: 7 }}>{n.v}</div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  {/* CSS width transition rather than a staggered motion
                      animation — a frozen bar would understate conversion. */}
                  <div style={{ height: "100%", width: `${n.pct}%`, transition: `width .7s ease ${i * 0.1}s`,
                    background: `linear-gradient(90deg,${PURPLE},${CYAN})`, boxShadow: `0 0 10px ${PURPLE}88` }} />
                </div>
              </div>
              {i < funnel.length - 1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 12px", flexShrink: 0 }}>
                  <ArrowRight size={13} color={SLATE_DIM} />
                  <span className="font-mono" style={{
                    fontFamily: MONO, fontSize: 9, fontWeight: 800, marginTop: 3,
                    color: (funnel[i + 1].conv ?? 0) >= 65 ? GREEN : (funnel[i + 1].conv ?? 0) >= 45 ? AMBER : RED,
                  }}>{(funnel[i + 1].conv ?? 0).toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard + Alpha Dossier */}
      <div style={{ display: "flex", gap: 16, minHeight: 300 }}>
        <div
          className="backdrop-blur-2xl bg-black/60 border border-white/10"
          style={{
            flex: selected ? "1 1 62%" : "1 1 100%", background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
            transition: "flex .28s ease",
          }}
        >
          <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 10 }}>
            Tactical Agent Leaderboard
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "0.5fr 1.5fr 1.1fr 1fr 0.9fr 0.8fr 0.7fr 0.8fr", gap: 8, padding: "0 8px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["Rank", "Agent", "Status", "Active Volume", "Pending GCI", "Close %", "Avg DOM", "Action"].map((h) => (
              <span key={h} className="tracking-wider" style={{ fontFamily: F, fontSize: 8, fontWeight: 800, letterSpacing: 1.1, color: SLATE_DIM, textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {agents.length === 0 ? (
              <div style={{ padding: 20, fontFamily: F, fontSize: 11, color: SLATE_DIM }}>No agent data available.</div>
            ) : agents.map((a, i) => {
              const st = STATUS[a.status];
              const medal = i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : null;
              const isSel = selected?.id === a.id;
              return (
                <div key={a.id}
                  onClick={() => setSelected(a)}
                  style={{
                    display: "grid", gridTemplateColumns: "0.5fr 1.5fr 1.1fr 1fr 0.9fr 0.8fr 0.7fr 0.8fr", gap: 8,
                    alignItems: "center", padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer", background: isSel ? `${PURPLE}14` : "transparent",
                    borderLeft: `2px solid ${isSel ? PURPLE : "transparent"}`, transition: "background .15s ease",
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {medal && <span style={{ width: 6, height: 6, borderRadius: "50%", background: medal, boxShadow: `0 0 8px ${medal}`, animation: "pmBlink 1.9s ease-in-out infinite", flexShrink: 0 }} />}
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: medal || SLATE_DIM }}>#{a.rank}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {i === 0 && <Crown size={11} color={GOLD} style={{ flexShrink: 0 }} />}
                    <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    {a.synthetic && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "1px 4px", flexShrink: 0 }}>SIM</span>}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.6, color: st.color,
                    background: `${st.color}14`, border: `1px solid ${st.color}55`, borderRadius: 999,
                    padding: "3px 8px", textAlign: "center", whiteSpace: "nowrap", boxShadow: `0 0 8px ${st.color}30`,
                  }}>{st.label.toUpperCase()}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: "#fff" }}>{fmtMoney(a.activeVolume)}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: PURPLE_LT }}>{fmtMoney(a.gci)}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: a.closeRate >= 50 ? GREEN : SLATE }}>{a.closeRate.toFixed(0)}%</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: a.avgDom != null && a.avgDom > a.deskAvgDom ? AMBER : SLATE }}>{a.avgDom != null ? `${Math.round(a.avgDom)}d` : "—"}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: CYAN, letterSpacing: 0.5 }}>[ OPEN ]</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alpha Dossier drawer — rendered directly (no AnimatePresence: a
            stalled exit would block the drawer from ever opening) */}
        {selected && (
          <div key={selected.id}
            className="backdrop-blur-2xl bg-black/60 border border-white/10"
            style={{
              flex: "1 1 38%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
              display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Zap size={13} color={PURPLE_LT} />
              <span className="tracking-wider" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: PURPLE_LT, textTransform: "uppercase" }}>
                Agent Alpha Dossier
              </span>
              <button onClick={() => setSelected(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={15} /></button>
            </div>

            <div style={{ border: `1px solid ${STATUS[selected.status].color}44`, borderRadius: 11, padding: 13, marginBottom: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff" }}>{selected.name}</span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM }}>#{selected.rank}</span>
                <span style={{
                  marginLeft: "auto", fontFamily: MONO, fontSize: 8, fontWeight: 800, color: STATUS[selected.status].color,
                  border: `1px solid ${STATUS[selected.status].color}66`, borderRadius: 999, padding: "2px 8px",
                }}>{STATUS[selected.status].label.toUpperCase()}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[["Volume", fmtMoney(selected.activeVolume), "#fff"], ["Close %", `${selected.closeRate.toFixed(0)}%`, GREEN], ["Avg DOM", selected.avgDom != null ? `${Math.round(selected.avgDom)}d` : "—", CYAN]].map(([l, v, c]) => (
                  <div key={l}>
                    <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                    <div className="font-mono" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline distribution */}
            <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.5, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 7 }}>
              Pipeline Distribution
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 13 }}>
              {[["Prospect", selected.prospect, AMBER], ["Active", selected.active, CYAN], ["Contract", selected.contract, PURPLE]].map(([l, v, c]) => (
                <div key={l} style={{ flex: 1, border: `1px solid ${c}44`, borderRadius: 8, padding: "8px 6px", textAlign: "center", background: `${c}0d` }}>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
                  <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7, letterSpacing: 0.8, color: SLATE_DIM, textTransform: "uppercase", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Retention alert */}
            {selected.status === "FLIGHT" && (
              <div style={{ border: `1px solid ${RED}55`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, background: `linear-gradient(135deg,${RED}12,rgba(0,0,0,0.3))`, boxShadow: `inset 0 0 20px ${RED}0d` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <ShieldAlert size={11} color={RED} />
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.5, color: RED }}>FLIGHT RISK / RETENTION ALERT</span>
                </div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 10, color: SLATE, lineHeight: 1.5 }}>
                  {selected.stalledCount} dormant file(s) · DOM {Math.round(selected.avgDom ?? 0)}d vs desk {Math.round(selected.deskAvgDom)}d. Retention intervention advised.
                </div>
              </div>
            )}

            <button onClick={generateCoaching} disabled={decrypting}
              style={{
                width: "100%", background: decrypting ? "rgba(168,85,247,0.15)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
                border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "11px 14px",
                fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: "#fff", cursor: decrypting ? "default" : "pointer",
                boxShadow: decrypting ? "none" : `0 0 15px ${PURPLE}88`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 11,
              }}>
              {decrypting ? <Loader2 size={13} style={{ animation: "pmSpin 1s linear infinite" }} /> : <Zap size={13} />}
              {decrypting ? "Decrypting…" : "AI Coaching Directive"}
            </button>

            {coach != null && (
              <pre className="bg-black/80 font-mono text-xs" style={{
                background: "rgba(0,0,0,0.85)", border: `1px solid ${PURPLE}44`, borderRadius: 10, padding: 12,
                fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "#e9d5ff", whiteSpace: "pre-wrap",
                wordBreak: "break-word", margin: "0 0 12px", maxHeight: 200, overflowY: "auto",
              }}>{coach}</pre>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={dispatchCoaching} disabled={!selected.email}
                style={{
                  width: "100%", background: "rgba(34,211,238,0.16)", border: `1px solid ${CYAN}77`, borderRadius: 10,
                  padding: "10px 14px", fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: CYAN, cursor: selected.email ? "pointer" : "default",
                  boxShadow: `0 0 14px ${CYAN}44`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: selected.email ? 1 : 0.45,
                }}>
                <Send size={12} /> [ Dispatch Coaching Script ]
              </button>
              <button onClick={() => onNavigate?.("intervention")} disabled={!onNavigate}
                style={{
                  width: "100%", background: "rgba(255,59,92,0.14)", border: `1px solid ${RED}77`, borderRadius: 10,
                  padding: "10px 14px", fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: RED, cursor: onNavigate ? "pointer" : "default",
                  boxShadow: `0 0 14px ${RED}33`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: onNavigate ? 1 : 0.45,
                }}>
                <ShieldAlert size={12} /> [ View Flagged Deals ] <ArrowRight size={11} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
