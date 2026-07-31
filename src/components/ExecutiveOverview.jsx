// src/components/ExecutiveOverview.jsx — SPARK OS Executive Overview: the
// predictive macro command center. Live Supabase `deals` telemetry drives
// animated financial tickers, a dual-axis cumulative-volume chart, an agent
// Alpha Generation Matrix, an AI friction scanner with an intervention
// bridge, a real-time deal ticker, and an institutional PDF tear-sheet.
//
// Standing adaptations, same rationale as every other Operations-suite file
// (see InterventionEngine.jsx for the full write-up):
//
// 1. Styling: no Tailwind is configured in this app — requested className
//    strings are kept (free upgrade if Tailwind ever lands) and backed by
//    equivalent inline styles.
//
// 2. Supabase client: this app's working client is `window.__supabase`
//    (lazily CDN-created in App.jsx); there is no lib/supabaseClient module.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Bar,
  AreaChart,
} from "recharts";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Zap, Activity, DollarSign, Gauge, TrendingUp, Loader2, Building2, Trophy,
  AlertTriangle, ArrowRight, FileDown, Radio,
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
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const ANCHOR_EMAIL = "team@usesparkai.app";
const STAGE_COLOR = { prospect: AMBER, active: CYAN, contract: PURPLE, closed: GREEN };

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtRelativeTime(dateStr) {
  if (!dateStr) return "—";
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return "—";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, (Date.now() - then) / 86400000);
}

function firstName(email) {
  if (!email) return "Unassigned";
  return email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Animated counter (framer-motion) ──────────────────────────────────────
function Ticker({ value, format = fmtMoney, duration = 1.6 }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const controls = animate(mv, value || 0, { duration, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [value, mv, duration]);
  return <motion.span>{text}</motion.span>;
}

// ── Predictive telemetry card ─────────────────────────────────────────────
function MetricCard({ icon: IconCmp, label, value, accent, delta, spark, format }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="backdrop-blur-2xl bg-black/60 border border-white/10 rounded-xl p-4"
      style={{
        flex: 1, position: "relative", overflow: "hidden",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: 16,
        boxShadow: `inset 0 0 34px ${accent}0d, 0 0 22px ${accent}14`,
        display: "flex", flexDirection: "column", gap: 7, minWidth: 0,
      }}
    >
      {/* Background sparkline */}
      {spark?.length > 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: 0.28, pointerEvents: "none" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 30, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`eoSpark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.2}
                fill={`url(#eoSpark-${label.replace(/\s/g, "")})`} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 7, color: accent, position: "relative" }}>
        <IconCmp size={13} strokeWidth={2.5} />
        <span className="tracking-wider" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: "#fff", textShadow: `0 0 16px ${accent}88`, letterSpacing: -0.5, position: "relative" }}>
        <Ticker value={value} format={format} />
      </div>
      {delta != null && (
        <div className="font-mono" style={{
          fontFamily: MONO, fontSize: 9.5, fontWeight: 700, position: "relative",
          color: delta >= 0 ? GREEN : RED, textShadow: `0 0 10px ${delta >= 0 ? GREEN : RED}88`,
        }}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% MoM
        </div>
      )}
    </motion.div>
  );
}

// ── Glassmorphic chart tooltip ────────────────────────────────────────────
function GlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      className="backdrop-blur-2xl bg-black/60 border border-white/10"
      style={{
        background: "rgba(4,4,8,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${PURPLE}55`, borderRadius: 10, padding: "10px 13px",
        fontFamily: MONO, fontSize: 10.5, color: "#fff", minWidth: 190,
        boxShadow: `0 0 24px ${PURPLE}33`,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6, letterSpacing: 1, color: PURPLE_LT }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ color: SLATE_DIM }}>CUMULATIVE</span><span>{fmtMoney(row.volume)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ color: SLATE_DIM }}>DEAL</span><span style={{ color: CYAN }}>{fmtMoney(row.dealValue)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: SLATE_DIM }}>AGENT</span><span>{row.agent}</span>
      </div>
    </div>
  );
}

// ── AI friction scanner ───────────────────────────────────────────────────
function scanForAnomalies(deals) {
  const out = [];
  const active = deals.filter((d) => d.stage !== "closed");

  active.forEach((d) => {
    const inStage = daysSince(d.last_activity_at);
    if (d.stage === "contract" && inStage != null && inStage > 45) {
      out.push({
        severity: "danger", dealId: d.id,
        text: `Deal ${d.shortId} in contract > ${Math.round(inStage)} days — friction detected on ${d.address}.`,
      });
    }
  });

  const atRisk = active.filter((d) => d.status === "at_risk");
  if (atRisk.length) {
    out.push({
      severity: "danger", dealId: atRisk[0].id,
      text: `${atRisk.length} deal${atRisk.length === 1 ? "" : "s"} flagged at-risk brokerage-wide, ${fmtMoney(atRisk.reduce((s, d) => s + d.volume, 0))} exposed.`,
    });
  }

  const stale = active.filter((d) => (daysSince(d.last_activity_at) ?? 0) > 21);
  if (stale.length) {
    out.push({
      severity: "danger", dealId: stale[0].id,
      text: `${stale.length} active deal${stale.length === 1 ? "" : "s"} dormant 21+ days — momentum decay detected.`,
    });
  }

  const luxury = active.filter((d) => d.volume >= 10_000_000);
  if (active.length && luxury.length / active.length > 0.4) {
    out.push({
      severity: "opportunity",
      text: `Portfolio concentration heavy in luxury tier (${luxury.length} deals $10M+). Deploy re-engagement campaigns for mid-tier inventory.`,
    });
  }

  const fresh = active.filter((d) => (daysSince(d.created_at) ?? 99) < 7);
  if (fresh.length) {
    out.push({
      severity: "opportunity",
      text: `${fresh.length} new deal${fresh.length === 1 ? "" : "s"} entered pipeline this week — ${fmtMoney(fresh.reduce((s, d) => s + d.volume, 0))} incremental volume.`,
    });
  }

  if (!out.length) {
    out.push({ severity: "opportunity", text: "No friction signatures detected. Portfolio health nominal across all active positions." });
  }
  return out;
}

// Char-scramble decryption for the directives block
function useDecrypt(lines, active) {
  const [out, setOut] = useState([]);
  useEffect(() => {
    if (!active) { setOut(lines); return; }
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let frame = 0;
    const total = 24;
    const id = setInterval(() => {
      frame += 1;
      setOut(lines.map((l) => {
        const reveal = Math.floor((frame / total) * l.text.length);
        let s = l.text.slice(0, reveal);
        for (let i = 0; i < Math.min(10, l.text.length - reveal); i++) s += chars[Math.floor(Math.random() * chars.length)];
        return { ...l, text: s };
      }));
      if (frame >= total) { clearInterval(id); setOut(lines); }
    }, 40);
    return () => clearInterval(id);
  }, [lines, active]);
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ExecutiveOverview({ user, onNavigate }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decrypting, setDecrypting] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const rootRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = window.__supabase;
      if (!sb) {
        if (!cancelled) { setError("Supabase isn't initialized yet — try again in a moment."); setLoading(false); setDecrypting(false); }
        return;
      }
      try {
        const { data: anchorUser, error: anchorError } = await sb
          .from("users").select("id, brokerage_id").eq("email", ANCHOR_EMAIL).maybeSingle();
        if (anchorError) throw new Error(anchorError.message);
        if (!anchorUser?.brokerage_id) throw new Error(`No brokerage found for ${ANCHOR_EMAIL}`);

        const [dealsRes, usersRes] = await Promise.all([
          sb.from("deals")
            .select("id, agent_id, client_name, address, stage, status, deal_volume, gci, probability, last_activity_at, created_at, updated_at, closing_date")
            .eq("brokerage_id", anchorUser.brokerage_id)
            .order("created_at", { ascending: true }),
          sb.from("users").select("id, email").eq("brokerage_id", anchorUser.brokerage_id),
        ]);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (usersRes.error) throw new Error(usersRes.error.message);
        if (cancelled) return;

        const emailById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.email]));
        setDeals((dealsRes.data || []).map((d) => {
          const volume = Number(d.deal_volume) || 0;
          return {
            id: d.id,
            shortId: `#${String(d.id).replace(/\D/g, "").slice(-3) || String(d.id).slice(0, 3).toUpperCase()}`,
            agentId: d.agent_id,
            agent: firstName(emailById[d.agent_id]),
            address: d.address || "Address unavailable",
            stage: d.stage,
            status: d.status,
            volume,
            gci: Math.round(volume * 0.03),
            probability: d.probability != null ? Number(d.probability) : null,
            last_activity_at: d.last_activity_at,
            created_at: d.created_at,
            updated_at: d.updated_at,
            closing_date: d.closing_date,
          };
        }));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load macro telemetry.");
      } finally {
        if (!cancelled) { setLoading(false); setTimeout(() => setDecrypting(false), 1100); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Top-line + predictive math ─────────────────────────────────────────
  const hud = useMemo(() => {
    const active = deals.filter((d) => d.stage !== "closed");
    const closed = deals.filter((d) => d.stage === "closed");
    const contract = deals.filter((d) => d.stage === "contract");
    const prospect = deals.filter((d) => d.stage === "prospect");

    const totalActiveVolume = active.reduce((s, d) => s + d.volume, 0);
    const pendingGci = contract.reduce((s, d) => s + d.gci, 0);
    const prospectGci = prospect.reduce((s, d) => s + d.gci, 0);
    const weightedPipeline = pendingGci * 0.85 + prospectGci * 0.25;

    // 30-day liquidity forecast: trailing daily close rate × 30, bounded by
    // what's actually in contract (can't close more than is under contract).
    const closedVolume = closed.reduce((s, d) => s + d.volume, 0);
    const spanDays = closed.length
      ? Math.max(30, (Date.now() - Math.min(...closed.map((d) => new Date(d.created_at).getTime()))) / 86400000)
      : 30;
    const trailingDaily = closedVolume / spanDays;
    const contractVolume = contract.reduce((s, d) => s + d.volume, 0);
    const liquidityForecast = Math.min(trailingDaily * 30, contractVolume || trailingDaily * 30);

    // MoM deltas — this month's created volume vs last month's
    const now = Date.now();
    const inWindow = (d, from, to) => {
      const t = new Date(d.created_at).getTime();
      return t >= now - from * 86400000 && t < now - to * 86400000;
    };
    const thisMo = deals.filter((d) => inWindow(d, 30, 0)).reduce((s, d) => s + d.volume, 0);
    const lastMo = deals.filter((d) => inWindow(d, 60, 30)).reduce((s, d) => s + d.volume, 0);
    const momDelta = lastMo > 0 ? ((thisMo - lastMo) / lastMo) * 100 : thisMo > 0 ? 100 : 0;

    return { totalActiveVolume, pendingGci, weightedPipeline, liquidityForecast, momDelta, activeCount: active.length };
  }, [deals]);

  // Cumulative series shared by the macro chart + card sparklines
  const chartData = useMemo(() => {
    let cum = 0;
    return deals.map((d) => {
      cum += d.volume;
      return {
        date: d.created_at ? new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—",
        volume: cum,
        dealValue: d.volume,
        agent: d.agent,
      };
    });
  }, [deals]);

  const sparkSeries = useMemo(() => chartData.map((r) => ({ v: r.volume })), [chartData]);

  // ── Alpha Generation Matrix ────────────────────────────────────────────
  const alphaMatrix = useMemo(() => {
    const byAgent = new Map();
    deals.forEach((d) => {
      const key = d.agentId || d.agent;
      if (!byAgent.has(key)) byAgent.set(key, { agent: d.agent, volume: 0, total: 0, closed: 0 });
      const rec = byAgent.get(key);
      rec.total += 1;
      if (d.stage === "closed") rec.closed += 1;
      if (d.stage !== "closed") rec.volume += d.volume;
    });
    return [...byAgent.values()]
      .map((r) => ({ ...r, closeRate: r.total ? (r.closed / r.total) * 100 : 0 }))
      .sort((a, b) => b.volume - a.volume);
  }, [deals]);

  const anomalies = useMemo(() => scanForAnomalies(deals), [deals]);
  const directives = useDecrypt(anomalies, decrypting);

  const activityFeed = useMemo(() =>
    [...deals]
      .sort((a, b) => new Date(b.updated_at || b.last_activity_at || 0) - new Date(a.updated_at || a.last_activity_at || 0))
      .slice(0, 14),
  [deals]);

  // ── Tear-sheet export ──────────────────────────────────────────────────
  const exportTearSheet = useCallback(async () => {
    if (exporting || !rootRef.current) return;
    setExporting(true);
    setExportPct(8);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      setExportPct(30);
      const canvas = await html2canvas(rootRef.current, { backgroundColor: "#050505", scale: 2, logging: false });
      setExportPct(72);
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const stamp = new Date();

      // Dark SPARK OS terminal canvas
      pdf.setFillColor(5, 5, 5);
      pdf.rect(0, 0, pw, ph, "F");

      // Branded header band — SPARK OS Real Estate AI
      const HEAD = 46;
      pdf.setFillColor(12, 8, 20);
      pdf.rect(0, 0, pw, HEAD, "F");
      pdf.setDrawColor(168, 85, 247);
      pdf.setLineWidth(1);
      pdf.line(0, HEAD, pw, HEAD);
      // Purple bolt glyph
      pdf.setFillColor(192, 132, 252);
      pdf.triangle(26, 14, 36, 14, 28, 24, "F");
      pdf.triangle(34, 22, 26, 32, 36, 22, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("SPARK OS REAL ESTATE AI", 48, 22);
      pdf.setTextColor(148, 163, 184);
      pdf.setFont("courier", "normal");
      pdf.setFontSize(7.5);
      pdf.text("MACRO INTELLIGENCE TEAR-SHEET", 48, 33);
      pdf.text(stamp.toISOString().replace("T", "  ").slice(0, 19) + " UTC", pw - 26, 33, { align: "right" });

      // Dashboard capture, fitted below the header band
      const availH = ph - HEAD - 26;
      const ratio = Math.min(pw / canvas.width, availH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(img, "PNG", (pw - w) / 2, HEAD + 12, w, h);

      // Footer
      pdf.setTextColor(120, 120, 140);
      pdf.setFont("courier", "normal");
      pdf.setFontSize(6.5);
      pdf.text("CONFIDENTIAL · SPARK OS REAL ESTATE AI · usesparkai.app", pw / 2, ph - 10, { align: "center" });

      // Professional document metadata
      pdf.setProperties({
        // ASCII-only title: jsPDF switches the whole string to UTF-16 the
        // moment it contains a non-ASCII glyph (e.g. an em-dash), which
        // some PDF readers/indexers surface as mojibake.
        title: `SPARK OS Macro Report - ${stamp.toISOString().slice(0, 10)}`,
        subject: "Brokerage macro-pipeline intelligence tear-sheet",
        author: "SPARK OS Real Estate AI",
        creator: "SPARK OS Real Estate AI",
        keywords: "spark os, real estate ai, brokerage, pipeline, macro telemetry",
      });
      setExportPct(95);
      pdf.save(`SPARK_OS_MACRO_REPORT_${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportPct(100);
    } catch (err) {
      setError(`Tear-sheet export failed: ${err.message}`);
    } finally {
      setTimeout(() => { setExporting(false); setExportPct(0); }, 500);
    }
  }, [exporting]);

  // Centralized SPARK OS loading state — shared pulsing purple bolt splash
  // so every Operations module boots identically.
  if (loading) return <SparkBoot />;

  return (
    <div
      ref={rootRef}
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6 overflow-y-auto"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 18, boxSizing: "border-box", overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes eoBlink { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        @keyframes eoSpin { to { transform: rotate(360deg); } }
        @keyframes eoSweep { 0% { transform: translateX(-6%); opacity:0; } 12% { opacity:.9; } 88% { opacity:.9; } 100% { transform: translateX(106%); opacity:0; } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Building2 size={20} color={PURPLE_LT} style={{ filter: `drop-shadow(0 0 8px ${PURPLE}aa)` }} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1.4, color: "#fff" }}>EXECUTIVE OVERVIEW</div>
          <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, color: SLATE_DIM, letterSpacing: 2 }}>
            MACRO PIPELINE — {hud.activeCount} ACTIVE POSITIONS TRACKED
          </div>
        </div>

        <button
          onClick={exportTearSheet}
          disabled={exporting}
          style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
            background: exporting ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.18)",
            border: `1px solid ${PURPLE}77`, borderRadius: 10, padding: "10px 16px",
            color: PURPLE_LT, fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1,
            textTransform: "uppercase", cursor: exporting ? "default" : "pointer",
            boxShadow: exporting ? "none" : `0 0 15px ${PURPLE}55`, position: "relative", overflow: "hidden",
          }}
        >
          {exporting ? <Loader2 size={13} style={{ animation: "eoSpin 1s linear infinite" }} /> : <FileDown size={13} />}
          {exporting ? `Generating… ${exportPct}%` : "Generate Tear-Sheet"}
          {exporting && (
            <span style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${exportPct}%`, background: PURPLE_LT, boxShadow: `0 0 8px ${PURPLE}`, transition: "width .3s ease" }} />
          )}
        </button>
      </div>

      {error && (
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px" }}>
          {error}
        </div>
      )}

      {/* Predictive Telemetry HUD */}
      <div style={{ display: "flex", gap: 13 }}>
        <MetricCard icon={DollarSign} label="Total Active Volume" value={hud.totalActiveVolume} accent={CYAN} delta={hud.momDelta} spark={sparkSeries} />
        <MetricCard icon={Activity} label="Pending GCI" value={hud.pendingGci} accent={GREEN} delta={hud.momDelta * 0.6} spark={sparkSeries} />
        <MetricCard icon={Gauge} label="Prob-Weighted Pipeline" value={hud.weightedPipeline} accent={PURPLE} delta={hud.momDelta * 0.8} spark={sparkSeries} />
        <MetricCard icon={TrendingUp} label="30-Day Liquidity Forecast" value={hud.liquidityForecast} accent={AMBER} delta={hud.momDelta * 0.45} spark={sparkSeries} />
      </div>

      {/* Cinematic Macro Trend — dual axis */}
      <div
        className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, height: 268, flexShrink: 0,
          display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        }}
      >
        <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 8 }}>
          Macro Portfolio Trend — Cumulative Volume × Deal Closures
        </div>

        {/* Radar sweep on initial render */}
        {chartData.length > 0 && (
          <div
            style={{
              position: "absolute", top: 34, bottom: 12, left: 16, width: 2, zIndex: 3, pointerEvents: "none",
              background: `linear-gradient(180deg, transparent, ${CYAN}, transparent)`,
              boxShadow: `0 0 18px ${CYAN}`,
              animation: "eoSweep 2.4s cubic-bezier(.4,0,.2,1) 1 forwards",
            }}
          />
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          {chartData.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: SLATE_DIM, letterSpacing: 1.5 }}>NO PORTFOLIO DATA AVAILABLE</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="eoVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PURPLE} stopOpacity={0.62} />
                    <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.22)" tick={{ fill: SLATE_DIM, fontSize: 9.5, fontFamily: MONO }} />
                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.22)" tick={{ fill: SLATE_DIM, fontSize: 9.5, fontFamily: MONO }} tickFormatter={fmtMoney} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.14)" tick={{ fill: "rgba(148,163,184,0.4)", fontSize: 9, fontFamily: MONO }} tickFormatter={fmtMoney} />
                <Tooltip content={<GlassTooltip />} cursor={{ stroke: `${CYAN}55`, strokeDasharray: "3 3" }} />
                <Bar yAxisId="right" dataKey="dealValue" fill={CYAN} fillOpacity={0.32} barSize={7} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                <Area yAxisId="left" type="monotone" dataKey="volume" stroke={PURPLE_LT} strokeWidth={2}
                  fill="url(#eoVolumeGrad)" isAnimationActive={false} dot={{ r: 2, fill: PURPLE_LT, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom: Directives / Alpha Matrix / Ticker */}
      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 320 }}>
        {/* AI Capital Directives */}
        <div
          className="backdrop-blur-2xl bg-black/60 border border-white/10"
          style={{
            flex: "1 1 38%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
            <Zap size={13} color={PURPLE_LT} />
            <span className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
              AI Capital Directives
            </span>
            {decrypting && <span className="font-mono" style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 8.5, color: PURPLE_LT, letterSpacing: 1.5 }}>DECRYPTING…</span>}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {directives.map((d, i) => {
              const color = d.severity === "danger" ? RED : GREEN;
              return (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${color}44`, borderRadius: 9, padding: "9px 11px", marginBottom: 9,
                    background: `linear-gradient(135deg, ${color}0e, rgba(0,0,0,0.25))`,
                    boxShadow: `inset 0 0 20px ${color}0a`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    {d.severity === "danger"
                      ? <AlertTriangle size={11} color={color} />
                      : <TrendingUp size={11} color={color} />}
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.8, color, textTransform: "uppercase" }}>
                      {d.severity === "danger" ? "Danger" : "Opportunity"}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.55, color: SLATE }}>{d.text}</div>
                  {d.severity === "danger" && onNavigate && (
                    <button
                      onClick={() => onNavigate("intervention", d.dealId)}
                      style={{
                        marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5,
                        background: `${RED}18`, border: `1px solid ${RED}66`, borderRadius: 6,
                        color: RED, fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1,
                        padding: "4px 9px", cursor: "pointer", boxShadow: `0 0 10px ${RED}33`,
                      }}
                    >
                      [ DEPLOY INTERVENTION ] <ArrowRight size={9} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Alpha Generation Matrix */}
        <div
          className="backdrop-blur-2xl bg-black/60 border border-white/10"
          style={{
            flex: "1 1 32%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
            <Trophy size={13} color={CYAN} />
            <span className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
              Alpha Generation Matrix
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", gap: 6, padding: "0 4px 7px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["Agent", "Volume", "Close %"].map((h) => (
              <span key={h} className="tracking-wider" style={{ fontFamily: F, fontSize: 8, fontWeight: 800, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {alphaMatrix.length === 0 ? (
              <div style={{ padding: 16, fontFamily: F, fontSize: 11, color: SLATE_DIM }}>No agent data available.</div>
            ) : alphaMatrix.map((a, i) => (
              <motion.div
                key={a.agent}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                style={{
                  display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", gap: 6, alignItems: "center",
                  padding: "9px 4px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {i < 3 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: CYAN, boxShadow: `0 0 8px ${CYAN}`, flexShrink: 0, animation: "eoBlink 1.8s ease-in-out infinite" }} />}
                  <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: i < 3 ? "#fff" : SLATE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.agent}</span>
                </span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: PURPLE_LT }}>{fmtMoney(a.volume)}</span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: a.closeRate >= 50 ? GREEN : SLATE }}>{a.closeRate.toFixed(0)}%</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Live Deal Ticker */}
        <div
          className="backdrop-blur-2xl bg-black/60 border border-white/10"
          style={{
            flex: "1 1 30%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
            <Radio size={13} color={GREEN} style={{ animation: "eoBlink 1.6s ease-in-out infinite" }} />
            <span className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
              Live Deal Ticker
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            <AnimatePresence initial={false}>
              {activityFeed.length === 0 ? (
                <div style={{ fontFamily: F, fontSize: 11, color: SLATE_DIM, padding: "8px 0" }}>No recent activity recorded.</div>
              ) : activityFeed.map((d) => (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  className="hover:translate-x-1"
                  style={{
                    display: "flex", gap: 9, padding: "8px 4px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                    transition: "transform .18s ease, background .18s ease", cursor: "default",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: STAGE_COLOR[d.stage] || SLATE_DIM, boxShadow: `0 0 6px ${STAGE_COLOR[d.stage] || "transparent"}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F, fontSize: 11, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong>{d.agent}</strong> · {d.address}
                    </div>
                    <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, marginTop: 2 }}>
                      {d.stage} · {fmtMoney(d.volume)} · {fmtRelativeTime(d.updated_at || d.last_activity_at)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
