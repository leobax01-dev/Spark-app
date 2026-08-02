// src/components/InterventionEngine.jsx — SPARK OS capital rescue terminal.
// Live Supabase `deals` telemetry drives an animated capital-at-risk HUD, a
// four-quadrant threat radar, a target-lock dossier with an AI rescue
// playbook decryptor and Monte-Carlo concession simulator, a dispatch/
// resolve execution loop that writes an audit trail back to Supabase, and a
// sortable rescue ledger.
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
// 3. Audit trail: `deals` has no interventions/audit table, and its `status`
//    column is a closed enum (on_track|stalled|at_risk) with no free-text
//    field. The resolve action therefore stamps the intervention into
//    `client_name`-adjacent safe columns it does own — `status:'on_track'`
//    plus a refreshed `last_activity_at` — and writes the full timestamped
//    record into `war_room_deals.details` (jsonb), the same table the
//    Surveillance Radar deploys into. That keeps a real, queryable audit
//    trail without inventing a schema that doesn't exist.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, ZAxis, Tooltip, Scatter,
  ReferenceLine, PieChart, Pie, Cell,
} from "recharts";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  AlertTriangle, TrendingDown, Clock, Target, Zap, Radar as RadarIcon, User, MapPin,
  DollarSign, Loader2, Send, CheckCircle2, X, ArrowUpDown, Layers,
} from "lucide-react";
import SparkBoot from "./SparkBoot";
import { useContainerWidth, breakpoints, chartHeight, axisProps, gridProps, legendProps } from "../responsive";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const CYAN = "#38bdf8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const YELLOW = "#facc15";
const RED = "#ef4444";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const ANCHOR_EMAIL = "team@usesparkai.app";

// Quadrant identity — thresholds are computed from the live payload medians
// so the grid self-calibrates to whatever book the brokerage is running.
const QUADRANTS = {
  Q1: { key: "Q1", label: "Critical Capital Detention", color: RED },
  Q2: { key: "Q2", label: "High-Volume Friction", color: AMBER },
  Q3: { key: "Q3", label: "Stagnant Assets", color: YELLOW },
  Q4: { key: "Q4", label: "Early Intervention", color: CYAN },
};

// Root-cause taxonomy. `deals` has no bottleneck column, so cause is derived
// deterministically from the columns that do exist (stage, probability,
// dormancy) — a data-driven stand-in, not invented free text.
const CAUSES = ["Financing", "Title", "Appraisal", "Inspection"];
const CAUSE_COLOR = { Financing: CYAN, Title: PURPLE, Appraisal: RED, Inspection: AMBER };

function deriveCause(d, daysStalled) {
  if (d.stage === "contract" && daysStalled > 30) return "Appraisal";
  if (d.stage === "contract") return "Financing";
  if (d.probability != null && d.probability < 35) return "Title";
  if (daysStalled > 25) return "Inspection";
  return "Financing";
}

function deriveFriction(d, daysStalled, cause) {
  switch (cause) {
    case "Appraisal": return `Appraisal gap suspected — under contract ${Math.round(daysStalled)}d with no movement.`;
    case "Title": return `Low close probability (${d.probability ?? "—"}%) — likely unresolved title or lien exposure.`;
    case "Inspection": return `Dormant ${Math.round(daysStalled)}d post-inspection — repair negotiation likely stalled.`;
    default: return `Buyer financing contingency unresolved at ${Math.round(daysStalled)}d.`;
  }
}

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 86400000);
}

function firstName(email) {
  if (!email) return "Unassigned";
  return email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Animated ticker ───────────────────────────────────────────────────────
function Ticker({ value, format = fmtMoney }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, value || 0, { duration: 1.5, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

function MetricCard({ icon: IconCmp, label, value, accent, badge, badgeColor, delta, raw }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
      className="backdrop-blur-2xl bg-black/60 border border-white/10 rounded-xl p-4"
      style={{
        flex: 1, background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: 16,
        boxShadow: "none",
        display: "flex", flexDirection: "column", gap: 7, minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: accent }}>
        <IconCmp size={13} strokeWidth={2.5} />
        <span className="tracking-wider" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" }}>{label}</span>
        {badge && (
          <span style={{
            marginLeft: "auto", fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1,
            color: badgeColor, background: `${badgeColor}18`, border: `1px solid ${badgeColor}66`,
            borderRadius: 999, padding: "2px 7px", boxShadow: "none", whiteSpace: "nowrap",
          }}>{badge}</span>
        )}
      </div>
      <div className="font-mono" style={{ fontFamily: MONO, fontSize: raw ? 17 : 24, fontWeight: 800, color: "#fff", textShadow: "none", letterSpacing: -0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {raw ? value : <Ticker value={value} format={typeof value === "number" && value < 1000 ? (v) => `${Math.round(v)}d` : fmtMoney} />}
      </div>
      {delta != null && (
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: delta >= 0 ? RED : GREEN, textShadow: "none"}}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% burn rate
        </div>
      )}
    </motion.div>
  );
}

// ── Pulsing beacon node ───────────────────────────────────────────────────
function Beacon({ cx, cy, payload, selectedId, onPick }) {
  const [hover, setHover] = useState(false);
  const color = QUADRANTS[payload.quadrant].color;
  const isSel = selectedId === payload.id;
  const r = 5 + Math.min(9, payload.volume / 2_800_000);
  return (
    <g style={{ cursor: "pointer" }} onClick={() => onPick(payload)}
       onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <circle cx={cx} cy={cy} r={(isSel || hover ? r + 12 : r + 7)} fill={color} opacity={isSel ? 0.3 : 0.16}>
        <animate attributeName="opacity" values={`${isSel ? 0.34 : 0.18};0.05;${isSel ? 0.34 : 0.18}`} dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={isSel || hover ? r + 3 : r} fill={color} fillOpacity={0.95}
        stroke={isSel ? "#fff" : "transparent"} strokeWidth={isSel ? 2 : 0}
        style={{ filter: "none", transition: "r .15s ease" }} />
    </g>
  );
}

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = QUADRANTS[d.quadrant].color;
  return (
    <div style={{
      background: "rgba(4,4,8,0.92)", backdropFilter: "none", WebkitBackdropFilter: "none",
      border: `1px solid ${color}66`, borderRadius: 9, padding: "10px 12px",
      fontFamily: MONO, fontSize: 10.5, color: "#fff", minWidth: 210, boxShadow: "none",
    }}>
      <div style={{ fontWeight: 800, marginBottom: 5, color, letterSpacing: 1 }}>{QUADRANTS[d.quadrant].label.toUpperCase()}</div>
      <div style={{ marginBottom: 4, opacity: 0.9, fontFamily: F, fontSize: 11 }}>{d.address}</div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: SLATE_DIM }}>VOLUME</span><span>{fmtMoney(d.volume)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: SLATE_DIM }}>STALLED</span><span>{Math.round(d.daysStalled)}d</span></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: SLATE_DIM }}>CAUSE</span><span style={{ color: CAUSE_COLOR[d.cause] }}>{d.cause}</span></div>
    </div>
  );
}

// ── AI Rescue Playbook (3-tier) ───────────────────────────────────────────
function buildPlaybook(d) {
  return [
    `TIER 1 — DIAGNOSTIC`,
    `Root cause: ${d.cause}. ${d.friction}`,
    `Verify with ${d.agent} within 24h; pull the last written counter and confirm whether the blocker is documented or assumed.`,
    ``,
    `TIER 2 — STRUCTURAL CONCESSION`,
    `Model a ${d.cause === "Appraisal" ? "3-5% price reconciliation to bridge the appraisal gap" : d.cause === "Financing" ? "seller-paid rate buydown (1-2 pts) in lieu of price movement" : d.cause === "Title" ? "escrow holdback against the unresolved title item" : "repair credit at 60-70% of the inspection ask"}.`,
    `Protect GCI: concession ceiling of ${fmtMoney(d.gci * 0.35)} before the deal turns margin-negative.`,
    ``,
    `TIER 3 — TACTICAL OUTREACH SCRIPT`,
    `"We've reviewed ${d.address} and we're ${Math.round(d.daysStalled)} days past our last movement. I'm authorized to solve this today — here's what we can do. What's the one thing that gets this signed by Friday?"`,
  ].join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────

export default function InterventionEngine({ user, focusDealId }) {
  const opsRef = useRef(null);
  const cw = useContainerWidth(opsRef);
  const bp = breakpoints(cw);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [scriptText, setScriptText] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [concession, setConcession] = useState(3);
  const [resolving, setResolving] = useState(false);
  const [toast, setToast] = useState(null);
  const [sortKey, setSortKey] = useState("volume");
  const [sortDir, setSortDir] = useState("desc");
  const decryptTimer = useRef(null);
  const didFocus = useRef(false);

  useEffect(() => { setScriptText(null); setDecrypting(false); setConcession(3); if (decryptTimer.current) clearInterval(decryptTimer.current); }, [selected?.id]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t); }, [toast]);

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
          sb.from("deals")
            .select("id, agent_id, address, stage, status, deal_volume, gci, probability, last_activity_at")
            .eq("brokerage_id", anchor.brokerage_id)
            .in("status", ["at_risk", "stalled"]),
          sb.from("users").select("id, email").eq("brokerage_id", anchor.brokerage_id),
        ]);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (cancelled) return;

        const emailById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.email]));
        setDeals((dealsRes.data || []).map((d) => {
          const volume = Number(d.deal_volume) || 0;
          const daysStalled = daysSince(d.last_activity_at);
          const cause = deriveCause(d, daysStalled);
          return {
            id: d.id,
            shortId: `#${String(d.id).replace(/\D/g, "").slice(-3) || String(d.id).slice(0, 3).toUpperCase()}`,
            agentId: d.agent_id,
            agent: firstName(emailById[d.agent_id]),
            agentEmail: emailById[d.agent_id] || "",
            address: d.address || "Address unavailable",
            volume,
            gci: Math.round(volume * 0.03),
            daysStalled,
            probability: d.probability,
            status: d.status === "at_risk" ? "AT_RISK" : "STALLED",
            stage: d.stage,
            cause,
            friction: deriveFriction(d, daysStalled, cause),
          };
        }));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load intervention feed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Quadrant assignment against live medians
  const graded = useMemo(() => {
    if (!deals.length) return [];
    const vMid = median(deals.map((d) => d.volume));
    const dMid = median(deals.map((d) => d.daysStalled));
    return deals.map((d) => {
      const hiV = d.volume >= vMid, hiD = d.daysStalled >= dMid;
      const quadrant = hiV && hiD ? "Q1" : hiV && !hiD ? "Q2" : !hiV && hiD ? "Q3" : "Q4";
      // Risk score: volume-weighted dormancy, 0-100
      const risk = Math.min(100, Math.round((d.daysStalled / Math.max(dMid * 2, 1)) * 55 + (d.volume / Math.max(vMid * 2, 1)) * 45));
      return { ...d, quadrant, risk, vMid, dMid };
    });
  }, [deals]);

  const thresholds = useMemo(() => ({
    vMid: graded[0]?.vMid ?? 0,
    dMid: graded[0]?.dMid ?? 0,
  }), [graded]);

  // ── Deep-link bridge: ?deal=<id> or focusDealId prop ───────────────────
  useEffect(() => {
    if (didFocus.current || !graded.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get("deal");
    const wanted = focusDealId || fromUrl;
    if (!wanted) { didFocus.current = true; return; }
    const hit = graded.find((d) => String(d.id) === String(wanted));
    if (hit) setSelected(hit);
    didFocus.current = true;
  }, [graded, focusDealId]);

  const hud = useMemo(() => {
    const totalVolume = deals.reduce((s, d) => s + d.volume, 0);
    const totalGci = deals.reduce((s, d) => s + d.gci, 0);
    const avgDays = deals.length ? deals.reduce((s, d) => s + d.daysStalled, 0) / deals.length : 0;
    const counts = deals.reduce((m, d) => { m[d.cause] = (m[d.cause] || 0) + 1; return m; }, {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const topCause = top ? `${top[0].toUpperCase()} — ${Math.round((top[1] / deals.length) * 100)}%` : "—";
    // Burn rate: share of exposure sitting past the 30-day dormancy line
    const burn = totalVolume > 0
      ? (deals.filter((d) => d.daysStalled > 30).reduce((s, d) => s + d.volume, 0) / totalVolume) * 100
      : 0;
    return { totalVolume, totalGci, avgDays, topCause, topCauseName: top?.[0], burn };
  }, [deals]);

  const taxonomy = useMemo(() =>
    CAUSES.map((c) => ({ name: c, value: deals.filter((d) => d.cause === c).length })).filter((r) => r.value > 0),
  [deals]);

  const ledger = useMemo(() => {
    const rows = [...graded];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }, [graded, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  // Rescue probability — concession lifts recovery odds against the drag of
  // dormancy and deal size; saturating so 10% never implies certainty.
  const rescueScore = useMemo(() => {
    if (!selected) return 0;
    const dormDrag = Math.min(45, (selected.daysStalled / 60) * 45);
    const sizeDrag = Math.min(15, (selected.volume / 25_000_000) * 15);
    const lift = 62 * (1 - Math.exp(-concession / 3.2));
    return Math.max(4, Math.min(97, Math.round(30 - dormDrag - sizeDrag + lift)));
  }, [selected, concession]);

  const generatePlaybook = useCallback(() => {
    if (!selected || decrypting) return;
    const full = buildPlaybook(selected);
    setDecrypting(true);
    setScriptText("");
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let frame = 0; const total = 34;
    decryptTimer.current = setInterval(() => {
      frame += 1;
      const reveal = Math.floor((frame / total) * full.length);
      let out = full.slice(0, reveal);
      for (let i = 0; i < Math.min(16, full.length - reveal); i++) out += chars[Math.floor(Math.random() * chars.length)];
      setScriptText(out);
      if (frame >= total) { clearInterval(decryptTimer.current); setScriptText(full); setDecrypting(false); }
    }, 38);
  }, [selected, decrypting]);

  const dispatchMailto = useCallback(() => {
    if (!selected) return;
    const subject = `SPARK OS: Intervention Required for ${selected.address}`;
    const body = [
      `Agent: ${selected.agent}`,
      `Asset: ${selected.address}`,
      `Volume: ${fmtMoney(selected.volume)} · GCI at risk: ${fmtMoney(selected.gci)}`,
      `Days stalled: ${Math.round(selected.daysStalled)} · Root cause: ${selected.cause}`,
      `Simulated concession: ${concession.toFixed(1)}% → rescue probability ${rescueScore}%`,
      ``,
      `--- AI RESCUE PLAYBOOK ---`,
      scriptText && !decrypting ? scriptText : buildPlaybook(selected),
      ``,
      `Generated by SPARK OS Real Estate AI — Intervention Engine`,
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(selected.agentEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setToast(`Dispatch drafted to ${selected.agent}.`);
  }, [selected, concession, rescueScore, scriptText, decrypting]);

  const logIntervention = useCallback(async () => {
    if (!selected || resolving) return;
    const sb = window.__supabase;
    if (!sb) { setToast("Log failed: Supabase isn't initialized yet."); return; }
    setResolving(true);
    try {
      const stamp = new Date().toISOString();
      const { error: upErr } = await sb.from("deals")
        .update({ status: "on_track", last_activity_at: stamp })
        .eq("id", selected.id);
      if (upErr) throw new Error(upErr.message);

      // Timestamped audit record (see header note — war_room_deals.details)
      await sb.from("war_room_deals").insert({
        brokerage_id: user?.brokerageId,
        user_id: selected.agentId,
        deal_name: `Broker Intervention — ${selected.address}`,
        negotiation_stage: "open",
        details: {
          type: "broker_intervention",
          deal_id: selected.id,
          logged_at: stamp,
          root_cause: selected.cause,
          days_stalled: Math.round(selected.daysStalled),
          simulated_concession_pct: concession,
          rescue_probability: rescueScore,
          resolved_to: "on_track",
        },
      });

      setDeals((prev) => prev.filter((d) => d.id !== selected.id));
      setToast(`Intervention logged · ${selected.address} restored to ACTIVE.`);
      setSelected(null);
    } catch (err) {
      setToast(`Log failed: ${err.message}`);
    } finally {
      setResolving(false);
    }
  }, [selected, resolving, user?.brokerageId, concession, rescueScore]);

  // Centralized SPARK OS loading state
  if (loading) return <SparkBoot label="SCANNING BROKERAGE PIPELINE FOR CAPITAL FRICTION..." />;

  const selColor = selected ? QUADRANTS[selected.quadrant].color : PURPLE_LT;

  return (
    <div ref={opsRef}
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6 overflow-y-auto"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 18, boxSizing: "border-box", overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes ieBlink{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes ieSpin{to{transform:rotate(360deg)}}
        @keyframes ieLaser{0%{top:0}50%{top:calc(100% - 2px)}100%{top:0}}
        input[type=range].ie-slider{-webkit-appearance:none;appearance:none;height:4px;border-radius:999px;outline:none}
        input[type=range].ie-slider::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:${PURPLE_LT};box-shadow:0 0 12px ${PURPLE};cursor:pointer;border:none}
      `}</style>

      {/* Toast — no AnimatePresence exit wrapper on purpose: a stalled exit
          animation would pin the notification on screen permanently. It
          animates in and unmounts hard when the dismiss timer fires. */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 60,
            background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: `1px solid ${toast.includes("failed") ? RED : PURPLE}88`, borderRadius: 10,
            padding: "11px 20px", color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700,
            boxShadow: "none", whiteSpace: "nowrap",
          }}
        >{toast}</motion.div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertTriangle size={20} color={RED} style={{ filter: "none"}} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1.4, color: "#fff" }}>INTERVENTION ENGINE</div>
          <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, color: SLATE_DIM, letterSpacing: 2 }}>
            CAPITAL RESCUE TERMINAL — {deals.length} ACTIVE TARGETS
          </div>
        </div>
      </div>

      {error && (
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px" }}>{error}</div>
      )}

      {/* Predictive Capital Telemetry HUD */}
      <div style={{ display: "flex", gap: 13 }}>
        <MetricCard icon={DollarSign} label="Critical Capital at Risk" value={hud.totalVolume} accent={RED}
          badge={hud.burn > 50 ? "HIGH THREAT" : "MONITORED"} badgeColor={hud.burn > 50 ? RED : AMBER} delta={hud.burn} />
        <MetricCard icon={TrendingDown} label="GCI Exposure" value={hud.totalGci} accent={AMBER}
          badge="STALLED" badgeColor={AMBER} />
        <MetricCard icon={Clock} label="Avg Intervention Window" value={hud.avgDays} accent={CYAN}
          badge="RECOVERY" badgeColor={CYAN} />
        <MetricCard icon={Layers} label="Macro Friction Taxonomy" value={hud.topCause} accent={PURPLE} raw
          badge={hud.topCauseName ? "DOMINANT" : undefined} badgeColor={PURPLE} />
      </div>

      {/* Quad-Matrix Radar + Dossier */}
      <div style={{ display: "flex", gap: 16, minHeight: 430 }}>
        {/* Radar */}
        <div
          className="backdrop-blur-2xl bg-black/60 border border-white/10"
          style={{
            flex: "1 1 62%", background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: "1px solid #27272a", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <RadarIcon size={13} color={SLATE_DIM} />
            <span className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
              Quad-Matrix Threat Grid — Days Stalled × Deal Volume
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {graded.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: SLATE_DIM, letterSpacing: 1.5 }}>NO CAPITAL FRICTION DETECTED</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 14, right: 22, bottom: 14, left: 4 }}>
                  <CartesianGrid {...gridProps(bp)} />
                  <XAxis type="number" dataKey="daysStalled" name="Days Stalled" unit="d"
                    stroke="rgba(255,255,255,0.2)" tick={{ fill: "#71717a", fontSize: 9.5, fontFamily: MONO }} />
                  <YAxis type="number" dataKey="volume" name="Volume"
                    stroke="rgba(255,255,255,0.2)" tick={{ fill: "#71717a", fontSize: 9.5, fontFamily: MONO }} tickFormatter={fmtMoney} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip content={<RadarTooltip />} cursor={false} />
                  <ReferenceLine x={thresholds.dMid} stroke={`${PURPLE}66`} strokeDasharray="4 4" />
                  <ReferenceLine y={thresholds.vMid} stroke={`${PURPLE}66`} strokeDasharray="4 4" />
                  <ReferenceLine x={thresholds.dMid} stroke="transparent"
                    label={{ value: "◤ Q2 HIGH-VOL FRICTION", position: "insideTopLeft", fill: `${AMBER}cc`, fontSize: 8, fontFamily: MONO }} />
                  <ReferenceLine x={thresholds.dMid} stroke="transparent"
                    label={{ value: "Q1 CRITICAL DETENTION ◥", position: "insideTopRight", fill: `${RED}cc`, fontSize: 8, fontFamily: MONO }} />
                  <ReferenceLine x={thresholds.dMid} stroke="transparent"
                    label={{ value: "◣ Q4 EARLY INTERVENTION", position: "insideBottomLeft", fill: `${CYAN}cc`, fontSize: 8, fontFamily: MONO }} />
                  <ReferenceLine x={thresholds.dMid} stroke="transparent"
                    label={{ value: "Q3 STAGNANT ASSETS ◢", position: "insideBottomRight", fill: `${YELLOW}cc`, fontSize: 8, fontFamily: MONO }} />
                  <Scatter data={graded} isAnimationActive={false}
                    shape={(p) => <Beacon {...p} selectedId={selected?.id} onPick={setSelected} />} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            {Object.values(QUADRANTS).map((q) => (
              <div key={q.key} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 9.5, color: SLATE_DIM }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: q.color, boxShadow: "none"}} />
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5 }}>{q.key}</span> {q.label}
              </div>
            ))}
          </div>
        </div>

        {/* Dossier / Diagnostics */}
        <div
          className="backdrop-blur-2xl bg-black/60 border border-white/10"
          style={{
            flex: "1 1 38%", background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: "1px solid #27272a", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto",
          }}
        >
          {/* Deliberately NOT wrapped in AnimatePresence. The idle panel
              hosts a recharts ResponsiveContainer whose unmount stalls the
              exit animation, and a stalled exit prevents the entering
              dossier from ever mounting — i.e. clicking a node would leave
              the broker staring at the idle view. The swap is a critical
              path, so it renders unconditionally; each branch still gets
              its own keyed entrance animation. */}
          <>
            {!selected ? (
              /* IDLE — Global Risk Diagnostics */
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Target size={13} color={PURPLE_LT} />
                  <span className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
                    Global Risk Diagnostics
                  </span>
                </div>

                {/* Scanning laser over mono grid */}
                <div style={{
                  position: "relative", height: 92, borderRadius: 10, overflow: "hidden", marginBottom: 16,
                  border: "1px dashed #27272a",
                  backgroundImage: "linear-gradient(rgba(148,163,184,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.07) 1px,transparent 1px)",
                  backgroundSize: "16px 16px",
                }}>
                  <div style={{
                    position: "absolute", left: 0, right: 0, height: 2, top: 0,
                    background: `linear-gradient(90deg,transparent,${PURPLE}cc,transparent)`,
                    boxShadow: "none", animation: "none",
                  }} />
                  <div className="font-mono" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: SLATE_DIM }}>
                    AWAITING TARGET LOCK
                  </div>
                </div>

                <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 6 }}>
                  Root-Cause Taxonomy
                </div>
                {taxonomy.length === 0 ? (
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 10, color: SLATE_DIM, padding: "10px 0" }}>NO FRICTION SIGNATURES</div>
                ) : (
                  <>
                    <div style={{ height: 168 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={taxonomy} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68}
                            paddingAngle={3} stroke="none" isAnimationActive={false}>
                            {taxonomy.map((t) => <Cell key={t.name} fill={CAUSE_COLOR[t.name]} fillOpacity={0.85} />)}
                          </Pie>
                          <Tooltip content={({ active, payload }) => active && payload?.length ? (
                            <div style={{ background: "rgba(4,4,8,0.92)", border: `1px solid ${CAUSE_COLOR[payload[0].name]}66`, borderRadius: 8, padding: "7px 10px", fontFamily: MONO, fontSize: 10, color: "#fff" }}>
                              {payload[0].name}: {payload[0].value} deal{payload[0].value === 1 ? "" : "s"}
                            </div>
                          ) : null} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                      {taxonomy.map((t) => (
                        <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 10, color: SLATE }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: CAUSE_COLOR[t.name], boxShadow: "none"}} />
                          {t.name} <span className="font-mono" style={{ fontFamily: MONO, color: SLATE_DIM }}>{Math.round((t.value / deals.length) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              /* TARGET LOCK */
              <motion.div key={selected.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Target size={13} color={selColor} />
                  <span className="tracking-wider" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: selColor, textTransform: "uppercase" }}>
                    Target Locked · {QUADRANTS[selected.quadrant].label}
                  </span>
                  <button onClick={() => setSelected(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={15} /></button>
                </div>

                <div style={{ border: `1px solid ${selColor}44`, borderRadius: 11, padding: 13, marginBottom: 13, background: "#18181b", boxShadow: "none"}}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
                    <MapPin size={13} color={selColor} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.35 }}>{selected.address}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <User size={12} color={SLATE_DIM} />
                    <span style={{ fontFamily: F, fontSize: 11, color: SLATE_DIM }}>{selected.agent}</span>
                    <span className="font-mono" style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 8.5, color: selColor, border: `1px solid ${selColor}55`, borderRadius: 999, padding: "2px 8px" }}>
                      RISK {selected.risk}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, paddingTop: 9, borderTop: "1px solid #27272a" }}>
                    {[["List Price", fmtMoney(selected.volume), "#fff"], ["Days Stalled", `${Math.round(selected.daysStalled)}d`, RED], ["GCI", fmtMoney(selected.gci), AMBER]].map(([l, v, c]) => (
                      <div key={l}>
                        <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", margin: "10px 0 3px" }}>Primary Friction · {selected.cause}</div>
                  <div style={{ fontFamily: F, fontSize: 11, color: SLATE, lineHeight: 1.5 }}>{selected.friction}</div>
                </div>

                {/* Capital Recovery Simulator */}
                <div style={{ border: "1px solid #27272a", borderRadius: 11, padding: 13, marginBottom: 13, background: "#18181b" }}>
                  <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 10 }}>
                    Capital Recovery Simulator
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: F, fontSize: 10, color: SLATE_DIM }}>Price Drop / Concession</span>
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: PURPLE_LT }}>{concession.toFixed(1)}%</span>
                  </div>
                  <input type="range" min={0} max={10} step={0.5} value={concession}
                    onChange={(e) => setConcession(Number(e.target.value))}
                    className="ie-slider"
                    style={{ width: "100%", marginBottom: 12, background: `linear-gradient(90deg,${PURPLE} ${concession * 10}%, #27272a ${concession * 10}%)` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span className="tracking-wider" style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase" }}>Rescue Probability</span>
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: rescueScore > 60 ? GREEN : rescueScore > 35 ? AMBER : RED, textShadow: "none"}}>{rescueScore}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: "#27272a", overflow: "hidden" }}>
                    <motion.div animate={{ width: `${rescueScore}%` }} transition={{ type: "spring", stiffness: 180, damping: 24 }}
                      style={{ height: "100%", background: `linear-gradient(90deg,${RED},${AMBER},${GREEN})`, backgroundSize: "300% 100%", backgroundPosition: `${100 - rescueScore}% 0`, boxShadow: "none"}} />
                  </div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5, color: SLATE_DIM, marginTop: 7 }}>
                    CONCESSION COST {fmtMoney(selected.volume * (concession / 100))} · NET GCI {fmtMoney(selected.gci - selected.gci * (concession / 100))}
                  </div>
                </div>

                <button onClick={generatePlaybook} disabled={decrypting}
                  className="shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                  style={{
                    width: "100%", background: decrypting ? "rgba(168,85,247,0.15)" : "#8b5cf6",
                    border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "12px 14px",
                    fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                    color: "#fff", cursor: decrypting ? "default" : "pointer",
                    boxShadow: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12,
                  }}>
                  {decrypting ? <Loader2 size={13} style={{ animation: "ieSpin 1s linear infinite" }} /> : <Zap size={13} />}
                  {decrypting ? "Decrypting…" : "Generate AI Rescue Playbook"}
                </button>

                {scriptText != null && (
                  <pre className="bg-black/80 font-mono text-xs" style={{
                    background: "rgba(0,0,0,0.85)", border: `1px solid ${PURPLE}44`, borderRadius: 10,
                    padding: 12, fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "#e9d5ff",
                    whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 13px", maxHeight: 230, overflowY: "auto",
                  }}>{scriptText}</pre>
                )}

                {/* Execution Loop */}
                <div style={{ borderTop: "1px solid #27272a", paddingTop: 13, display: "flex", flexDirection: "column", gap: 9 }}>
                  <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase" }}>
                    Agent Dispatch Protocol
                  </div>
                  <button onClick={dispatchMailto} disabled={!selected.agentEmail}
                    style={{
                      width: "100%", background: "rgba(34,211,238,0.16)", border: `1px solid ${CYAN}77`, borderRadius: 10,
                      padding: "11px 14px", fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1,
                      textTransform: "uppercase", color: CYAN, cursor: selected.agentEmail ? "pointer" : "default",
                      boxShadow: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: selected.agentEmail ? 1 : 0.45,
                    }}>
                    <Send size={13} /> [ Dispatch to Agent ]
                  </button>
                  <button onClick={logIntervention} disabled={resolving}
                    style={{
                      width: "100%", background: resolving ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.18)",
                      border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "11px 14px",
                      fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                      color: PURPLE_LT, cursor: resolving ? "default" : "pointer",
                      boxShadow: "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                    {resolving ? <Loader2 size={13} style={{ animation: "ieSpin 1s linear infinite" }} /> : <CheckCircle2 size={13} />}
                    {resolving ? "Logging…" : "[ Log Intervention & Resolve ]"}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        </div>
      </div>

      {/* Active Rescue Dispatch Ledger */}
      <div
        className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: "1px solid #27272a", borderRadius: 14, padding: 16, minHeight: 200,
          display: "flex", flexDirection: "column",
        }}
      >
        <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 10 }}>
          Active Rescue Dispatch Ledger
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 1fr 1fr 1fr 1.1fr", gap: 8, padding: "0 8px 8px", borderBottom: "1px solid #27272a" }}>
          {[["address", "Property"], ["agent", "Agent"], ["volume", "Volume"], ["daysStalled", "Days Stalled"], ["risk", "Risk"], ["quadrant", "Threat Level"]].map(([key, label]) => (
            <button key={key} onClick={() => toggleSort(key)}
              style={{
                background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontFamily: F, fontSize: 8, fontWeight: 800, letterSpacing: 1.2,
                color: sortKey === key ? PURPLE_LT : SLATE_DIM, textTransform: "uppercase",
              }}>
              {label}<ArrowUpDown size={9} style={{ opacity: sortKey === key ? 1 : 0.35 }} />
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {ledger.length === 0 ? (
            <div style={{ padding: 22, textAlign: "center", fontFamily: F, fontSize: 12, color: SLATE_DIM }}>No at-risk or stalled deals in the pipeline.</div>
          ) : ledger.map((d) => {
            const q = QUADRANTS[d.quadrant];
            const isSel = selected?.id === d.id;
            return (
              <div key={d.id} onClick={() => setSelected(d)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1.1fr 1fr 1fr 1fr 1.1fr", gap: 8, alignItems: "center",
                  padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer",
                  background: isSel ? `${q.color}12` : "transparent",
                  borderLeft: `2px solid ${isSel ? q.color : "transparent"}`,
                  transition: "background .15s ease, transform .15s ease",
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "#18181b"; e.currentTarget.style.transform = "translateX(3px)"; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateX(0)"; }}>
                <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.address}</span>
                <span style={{ fontFamily: F, fontSize: 11, color: SLATE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.agent}</span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: "#fff" }}>{fmtMoney(d.volume)}</span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: d.daysStalled > 30 ? RED : SLATE }}>{Math.round(d.daysStalled)}d</span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: d.risk > 65 ? RED : d.risk > 40 ? AMBER : CYAN }}>{d.risk}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, color: q.color,
                  background: `${q.color}14`, border: `1px solid ${q.color}55`, borderRadius: 999,
                  padding: "3px 8px", whiteSpace: "nowrap", textAlign: "center",
                  boxShadow: "none",
                }}>{q.key} · {q.label.split(" ")[0].toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
