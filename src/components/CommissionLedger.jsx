// src/components/CommissionLedger.jsx — SPARK OS Financial Command Center &
// Predictive Cash Flow Terminal. Live Supabase `deals` telemetry drives a
// predictive financial HUD, a 90-day cash-flow / split-waterfall visualizer,
// a sortable ledger matrix with a per-deal commission audit drawer, and
// CSV + institutional PDF tear-sheet export.
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
// 3. Animation: recharts series get isAnimationActive={false} and no
//    content is gated behind a framer-motion entrance — staggered opacity
//    entrances do not reliably complete in embedded/throttled contexts and
//    would silently hide ledger rows and metrics. Count-up tickers still
//    animate because they drive text, not visibility.
//
// 4. Split economics: `deals` carries commission_split_pct but has no cap,
//    desk-fee, or transaction-fee columns. Those use documented brokerage
//    conventions (CAP_TARGET / DESK_FEE / TXN_FEE below) applied uniformly,
//    and cap progress is computed from the agent's real closed GCI. They are
//    labelled "desk convention" in the drawer so nobody reads them as
//    contractual terms pulled from the database.
//
// 5. Demo fallback: when live data is too sparse to populate a terminal,
//    a synthetic luxury portfolio is generated. Synthetic rows are badged
//    SIM and the header shows a SIMULATED LEDGER warning — a broker must
//    never mistake generated commission for booked commission.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line,
  AreaChart, Area, Legend,
} from "recharts";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  DollarSign, TrendingUp, Wallet, Gauge, Search, Download, FileDown, Loader2,
  X, CheckCircle2, ShieldAlert, ArrowUpDown,
} from "lucide-react";
import SparkBoot from "./SparkBoot";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const CYAN = "#38bdf8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const ANCHOR_EMAIL = "team@usesparkai.app";
const MIN_DEALS = 4;

// Desk conventions (not database columns — see header note 4)
const CAP_TARGET = 100_000;   // agent annual company-dollar cap
const DESK_FEE = 1_200;       // per-transaction desk fee
const TXN_FEE = 495;          // per-transaction compliance/admin fee

const STATUS_META = {
  CLOSED: { label: "Closed", color: GREEN },
  ACTIVE: { label: "Active", color: CYAN },
  PENDING: { label: "Pending", color: AMBER },
  AT_RISK: { label: "At Risk", color: RED },
};

const VIEWS = [
  { id: "forecast", label: "[ 90-Day Forecast ]" },
  { id: "waterfall", label: "[ Split Waterfall ]" },
  { id: "slices", label: "[ Monthly Revenue Slices ]" },
];

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtFull(n) { return `$${Math.round(n || 0).toLocaleString()}`; }
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}
function daysUntil(d) {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? (t - Date.now()) / 86400000 : null;
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

function deriveStatus(d) {
  if (d.stage === "closed") return "CLOSED";
  if (d.status === "at_risk") return "AT_RISK";
  if (d.stage === "prospect") return "PENDING";
  return "ACTIVE";
}

// AI cash-flow risk: dormancy shaves confidence off the stored probability.
function riskAdjust(deal) {
  const dormant = daysSince(deal.lastActivity) ?? 0;
  let penalty = 0;
  if (dormant > 45) penalty = 15;
  else if (dormant > 30) penalty = 10;
  else if (dormant > 21) penalty = 5;
  const adjusted = Math.max(0, Math.min(100, deal.probability - penalty));
  const flag = penalty > 0
    ? `Deal DOM > ${Math.floor(dormant / 15) * 15} days. Probability adjusted down by ${penalty}%.`
    : null;
  return { adjusted, penalty, flag, dormant };
}

// ── Demo-safe synthesizer ─────────────────────────────────────────────────
const SYNTH = [
  ["M. Torres", "1 Star Island Dr, Miami, FL", 24_500_000, "closed", 100, 75, -22],
  ["J. Whitfield", "142 Further Ln, East Hampton, NY", 18_200_000, "contract", 85, 70, 18],
  ["R. Chen", "9200 Wilshire Blvd, Beverly Hills, CA", 12_800_000, "contract", 70, 75, 34],
  ["A. Delacroix", "77 Overlook Dr, Aspen, CO", 9_400_000, "active", 55, 70, 52],
  ["M. Torres", "455 Ocean Blvd, Golden Beach, FL", 8_100_000, "active", 60, 75, 41],
  ["K. Osei", "212 Central Park South, New York, NY", 6_750_000, "closed", 100, 65, -9],
  ["J. Whitfield", "88 Meadow Ln, Southampton, NY", 5_200_000, "prospect", 30, 70, 78],
  ["R. Chen", "3 Fisher Island Dr, Miami Beach, FL", 4_400_000, "active", 45, 75, 63],
  ["S. Barrington", "615 Casuarina Concourse, Coral Gables, FL", 3_100_000, "prospect", 25, 70, 88],
  ["K. Osei", "1500 Sunset Plaza Dr, Los Angeles, CA", 2_300_000, "active", 50, 65, 29],
];
function synthesizePortfolio() {
  const now = Date.now(), day = 86400000;
  return SYNTH.map(([agent, address, volume, stage, prob, split, closeInDays], i) => {
    const gci = Math.round(volume * 0.03);
    return {
      id: `sim-${i}`, synthetic: true,
      agent, agentEmail: "", agentId: `sim-agent-${agent}`,
      property: address, volume, gci,
      agentPayoutPercent: split,
      brokerageNet: Math.round(gci * (1 - split / 100)),
      probability: prob,
      projectedCloseDate: new Date(now + closeInDays * day).toISOString(),
      lastActivity: new Date(now - (i * 6 + 3) * day).toISOString(),
      status: stage === "closed" ? "CLOSED" : stage === "prospect" ? "PENDING" : "ACTIVE",
      stage,
    };
  });
}

// ── Ticker ────────────────────────────────────────────────────────────────
function Ticker({ value, format }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, value || 0, { duration: 1.5, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

// No entrance animation gating visibility — see header note 3.
function MetricCard({ icon: IconCmp, label, value, format, accent, delta, deltaLabel, spark }) {
  const gid = `clSpark-${label.replace(/[^a-z]/gi, "")}`;
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10 rounded-xl p-4"
      style={{
        flex: 1, position: "relative", overflow: "hidden", minWidth: 0,
        background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: 15,
        boxShadow: "none",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
      {spark?.length > 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: 0.26, pointerEvents: "none" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 28, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.2} fill={`url(#${gid})`} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: accent, position: "relative" }}>
        <IconCmp size={13} strokeWidth={2.5} />
        <span className="tracking-wider" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 23, fontWeight: 800, color: "#fff", textShadow: "none", letterSpacing: -0.4, position: "relative", whiteSpace: "nowrap" }}>
        <Ticker value={value} format={format} />
      </div>
      {delta != null && (
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, position: "relative", color: delta >= 0 ? GREEN : delta > -12 ? AMBER : RED, textShadow: "none"}}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% {deltaLabel || "MoM"}
        </div>
      )}
    </div>
  );
}

function GlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const rows = [
    ["PROJECTED GCI", fmtFull(r.gci ?? r.confirmed + r.weighted)],
    ["AGENT PAYOUT", fmtFull(r.payout)],
    ["BROKERAGE NET", fmtFull(r.net)],
    ["WEIGHTED PROB", r.avgProb != null ? `${Math.round(r.avgProb)}%` : "—"],
  ];
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      background: "rgba(4,4,8,0.9)", backdropFilter: "none", WebkitBackdropFilter: "none",
      border: `1px solid ${PURPLE}55`, borderRadius: 10, padding: "10px 13px",
      fontFamily: MONO, fontSize: 10.5, color: "#fff", minWidth: 215, boxShadow: "none",
    }}>
      <div style={{ fontWeight: 800, marginBottom: 6, letterSpacing: 1, color: PURPLE_LT }}>{label}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ color: SLATE_DIM }}>{k}</span><span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || { label: status, color: SLATE_DIM };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: 8, fontWeight: 800,
      letterSpacing: 0.7, textTransform: "uppercase", color: m.color, background: `${m.color}14`,
      border: `1px solid ${m.color}55`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap",
      boxShadow: "none",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, boxShadow: "none"}} />
      {m.label}
    </span>
  );
}

function toCsv(rows) {
  const headers = ["Agent", "Property", "Deal Volume", "Total GCI", "Payout Split %", "Brokerage Net", "Probability %", "Risk-Adjusted %", "Projected Close", "Status", "Source"];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const { adjusted } = riskAdjust(r);
    lines.push([
      r.agent, r.property, r.volume, r.gci, r.agentPayoutPercent, r.brokerageNet,
      r.probability, adjusted, r.projectedCloseDate ? fmtDate(r.projectedCloseDate) : "",
      STATUS_META[r.status]?.label || r.status, r.synthetic ? "SIMULATED" : "LIVE",
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
  });
  return lines.join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CommissionLedger({ user }) {
  const [rawDeals, setRawDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("forecast");
  const [selected, setSelected] = useState(null);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);

  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bracketFilter, setBracketFilter] = useState("all");
  const [sortKey, setSortKey] = useState("gci");
  const [sortDir, setSortDir] = useState("desc");

  const rootRef = useRef(null);

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
          sb.from("deals").select("id, agent_id, address, stage, status, deal_volume, commission_split_pct, probability, closing_date, last_activity_at").eq("brokerage_id", anchor.brokerage_id),
          sb.from("users").select("id, email").eq("brokerage_id", anchor.brokerage_id),
        ]);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (usersRes.error) throw new Error(usersRes.error.message);
        if (cancelled) return;
        const emailById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.email]));
        setRawDeals((dealsRes.data || []).map((d) => {
          const volume = Number(d.deal_volume) || 0;
          const gci = Math.round(volume * 0.03);
          const split = Number(d.commission_split_pct ?? 70);
          return {
            id: d.id, synthetic: false,
            agentId: d.agent_id, agent: firstName(emailById[d.agent_id]), agentEmail: emailById[d.agent_id] || "",
            property: d.address || "Address unavailable", volume, gci,
            agentPayoutPercent: split, brokerageNet: Math.round(gci * (1 - split / 100)),
            probability: d.probability != null ? Number(d.probability) : 50,
            projectedCloseDate: d.closing_date, lastActivity: d.last_activity_at,
            status: deriveStatus(d), stage: d.stage,
          };
        }));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load commission ledger.");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const { deals, synthesized } = useMemo(() => {
    const uniqueAgents = new Set(rawDeals.map((d) => d.agentId)).size;
    const sparse = rawDeals.length < MIN_DEALS || uniqueAgents < 2;
    return sparse ? { deals: [...rawDeals, ...synthesizePortfolio()], synthesized: true } : { deals: rawDeals, synthesized: false };
  }, [rawDeals]);

  const agentOptions = useMemo(() => Array.from(new Set(deals.map((d) => d.agent))).sort(), [deals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = deals.filter((d) => {
      if (q && !d.property.toLowerCase().includes(q) && !d.agent.toLowerCase().includes(q)) return false;
      if (agentFilter !== "all" && d.agent !== agentFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (bracketFilter === "1m" && d.volume < 1_000_000) return false;
      if (bracketFilter === "5m" && d.volume < 5_000_000) return false;
      if (bracketFilter === "10m" && d.volume < 10_000_000) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
  }, [deals, search, agentFilter, statusFilter, bracketFilter, sortKey, sortDir]);

  // ── Financial math ─────────────────────────────────────────────────────
  const hud = useMemo(() => {
    const open = filtered.filter((d) => d.status !== "CLOSED");
    const totalGci = filtered.reduce((s, d) => s + d.gci, 0);
    const riskWeighted = filtered.reduce((s, d) => s + d.gci * (riskAdjust(d).adjusted / 100), 0);
    const brokerageNet = filtered.reduce((s, d) => s + d.brokerageNet, 0);
    // 90-day liquidity: risk-weighted agent-side + brokerage-side cash landing
    // inside the next 90 days, from projected close dates.
    const liquidity = open.reduce((s, d) => {
      const dte = daysUntil(d.projectedCloseDate);
      if (dte == null || dte < 0 || dte > 90) return s;
      return s + d.gci * (riskAdjust(d).adjusted / 100);
    }, 0);
    // MoM proxy: share of weighted value closing in the next 30 vs 30-60 days
    const w = (lo, hi) => open.reduce((s, d) => {
      const dte = daysUntil(d.projectedCloseDate);
      return dte != null && dte >= lo && dte < hi ? s + d.gci * (riskAdjust(d).adjusted / 100) : s;
    }, 0);
    const m1 = w(0, 30), m2 = w(30, 60);
    const mom = m2 > 0 ? ((m1 - m2) / m2) * 100 : m1 > 0 ? 100 : 0;
    const slippage = totalGci > 0 ? ((riskWeighted - totalGci) / totalGci) * 100 : 0;
    return { liquidity, totalGci, riskWeighted, brokerageNet, mom, slippage };
  }, [filtered]);

  const spark = useMemo(() => {
    let cum = 0;
    return [...filtered].sort((a, b) => new Date(a.projectedCloseDate || 0) - new Date(b.projectedCloseDate || 0))
      .map((d) => { cum += d.gci; return { v: cum }; });
  }, [filtered]);

  // ── Chart series ───────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (view === "waterfall") {
      const byAgent = new Map();
      filtered.forEach((d) => {
        if (!byAgent.has(d.agent)) byAgent.set(d.agent, { name: d.agent, gci: 0, payout: 0, net: 0, probSum: 0, n: 0 });
        const r = byAgent.get(d.agent);
        r.gci += d.gci;
        r.payout += Math.round(d.gci * (d.agentPayoutPercent / 100));
        r.net += d.brokerageNet;
        r.probSum += riskAdjust(d).adjusted; r.n += 1;
      });
      return [...byAgent.values()].map((r) => ({ ...r, confirmed: r.payout, weighted: r.net, avgProb: r.n ? r.probSum / r.n : 0 }))
        .sort((a, b) => b.gci - a.gci);
    }
    if (view === "slices") {
      const byMonth = new Map();
      filtered.forEach((d) => {
        if (!d.projectedCloseDate) return;
        const dt = new Date(d.projectedCloseDate);
        const key = dt.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
        if (!byMonth.has(key)) byMonth.set(key, { name: key, ts: dt.getTime(), gci: 0, payout: 0, net: 0, confirmed: 0, weighted: 0, probSum: 0, n: 0 });
        const r = byMonth.get(key);
        const adj = riskAdjust(d).adjusted;
        r.gci += d.gci;
        r.payout += Math.round(d.gci * (d.agentPayoutPercent / 100));
        r.net += d.brokerageNet;
        if (d.status === "CLOSED") r.confirmed += d.gci; else r.weighted += Math.round(d.gci * (adj / 100));
        r.probSum += adj; r.n += 1;
      });
      return [...byMonth.values()].sort((a, b) => a.ts - b.ts).map((r) => ({ ...r, avgProb: r.n ? r.probSum / r.n : 0 }));
    }
    // 90-day forecast — 30/60/90 horizons
    const buckets = [[0, 30, "0-30d"], [30, 60, "30-60d"], [60, 90, "60-90d"]];
    return buckets.map(([lo, hi, name]) => {
      const inWin = filtered.filter((d) => {
        const dte = daysUntil(d.projectedCloseDate);
        return dte != null && dte >= lo && dte < hi;
      });
      const confirmed = inWin.filter((d) => d.status === "CLOSED").reduce((s, d) => s + d.gci, 0);
      const weighted = inWin.filter((d) => d.status !== "CLOSED").reduce((s, d) => s + Math.round(d.gci * (riskAdjust(d).adjusted / 100)), 0);
      const payout = inWin.reduce((s, d) => s + Math.round(d.gci * (d.agentPayoutPercent / 100)), 0);
      const net = inWin.reduce((s, d) => s + d.brokerageNet, 0);
      const probs = inWin.map((d) => riskAdjust(d).adjusted);
      return { name, confirmed, weighted, payout, net, gci: confirmed + weighted, avgProb: probs.length ? probs.reduce((s, p) => s + p, 0) / probs.length : 0, count: inWin.length };
    });
  }, [filtered, view]);

  // ── Audit drawer economics ─────────────────────────────────────────────
  const audit = useMemo(() => {
    if (!selected) return null;
    const { adjusted, penalty, flag, dormant } = riskAdjust(selected);
    const agentGross = Math.round(selected.gci * (selected.agentPayoutPercent / 100));
    const companyDollar = selected.gci - agentGross;
    const deductions = DESK_FEE + TXN_FEE;
    const agentNet = agentGross - deductions;
    // Cap progress from the agent's real closed company-dollar YTD
    const capPaid = deals
      .filter((d) => d.agentId === selected.agentId && d.status === "CLOSED")
      .reduce((s, d) => s + (d.gci - Math.round(d.gci * (d.agentPayoutPercent / 100))), 0);
    const capPct = Math.min(100, (capPaid / CAP_TARGET) * 100);
    return { adjusted, penalty, flag, dormant, agentGross, companyDollar, deductions, agentNet, capPaid, capPct };
  }, [selected, deals]);

  function toggleSort(k) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  const approvePayout = useCallback(async () => {
    if (!selected || approving) return;
    if (selected.synthetic) { setToast("Payout release unavailable on simulated rows."); return; }
    const sb = window.__supabase;
    if (!sb) { setToast("Approve failed: Supabase isn't initialized yet."); return; }
    setApproving(true);
    try {
      const { error: upErr } = await sb.from("deals")
        .update({ stage: "closed", status: "on_track", last_activity_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (upErr) throw new Error(upErr.message);
      setRawDeals((prev) => prev.map((d) => d.id === selected.id ? { ...d, stage: "closed", status: "CLOSED" } : d));
      setSelected((s) => s ? { ...s, status: "CLOSED", stage: "closed" } : s);
      setToast(`Payout released · ${selected.property} marked CLOSED.`);
    } catch (err) {
      setToast(`Approve failed: ${err.message}`);
    } finally { setApproving(false); }
  }, [selected, approving]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SPARK_OS_COMMISSION_LEDGER_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setToast(`CSV exported · ${filtered.length} rows.`);
  }, [filtered]);

  const exportStatement = useCallback(() => {
    if (!selected) return;
    const a2 = audit;
    const csv = [
      ["SPARK OS Real Estate AI — Commission Statement"].join(","),
      [`Generated,${new Date().toISOString()}`].join(","),
      "",
      ["Field", "Value"].join(","),
      ["Agent", selected.agent], ["Property", selected.property],
      ["Deal Volume", selected.volume], ["Total GCI", selected.gci],
      ["Payout Split %", selected.agentPayoutPercent],
      ["Agent Gross", a2.agentGross], ["Desk Fee", DESK_FEE], ["Transaction Fee", TXN_FEE],
      ["Agent Net", a2.agentNet], ["Company Dollar", a2.companyDollar],
      ["Brokerage Net", selected.brokerageNet],
      ["Stated Probability %", selected.probability], ["Risk-Adjusted %", a2.adjusted],
      ["Projected Close", selected.projectedCloseDate ? fmtDate(selected.projectedCloseDate) : ""],
      ["Status", STATUS_META[selected.status]?.label || selected.status],
      ["Source", selected.synthetic ? "SIMULATED" : "LIVE"],
    ].map((r) => Array.isArray(r) ? r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",") : r).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SPARK_OS_STATEMENT_${selected.property.split(",")[0].replace(/\W+/g, "_")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setToast("Commission statement exported.");
  }, [selected, audit]);

  const exportPdf = useCallback(async () => {
    if (exporting || !rootRef.current) return;
    setExporting(true); setExportPct(8);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      setExportPct(30);
      const canvas = await html2canvas(rootRef.current, { backgroundColor: "#050505", scale: 2, logging: false });
      setExportPct(70);
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      const stamp = new Date();

      pdf.setFillColor(5, 5, 5); pdf.rect(0, 0, pw, ph, "F");
      const HEAD = 62;
      pdf.setFillColor(12, 8, 20); pdf.rect(0, 0, pw, HEAD, "F");
      pdf.setDrawColor(168, 85, 247); pdf.setLineWidth(1); pdf.line(0, HEAD, pw, HEAD);
      pdf.setFillColor(192, 132, 252);
      pdf.triangle(26, 16, 36, 16, 28, 26, "F"); pdf.triangle(34, 24, 26, 34, 36, 24, "F");
      pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
      pdf.text("SPARK OS REAL ESTATE AI", 48, 24);
      pdf.setTextColor(148, 163, 184); pdf.setFont("courier", "normal"); pdf.setFontSize(7.5);
      pdf.text("COMMISSION AUDIT & PRO-FORMA TEAR-SHEET", 48, 35);
      pdf.text(stamp.toISOString().replace("T", "  ").slice(0, 19) + " UTC", pw - 26, 24, { align: "right" });
      // Executive summary strip
      pdf.setFontSize(7);
      pdf.setTextColor(200, 200, 215);
      const summary = `90D LIQUIDITY ${fmtMoney(hud.liquidity)}   |   FILTERED GCI ${fmtMoney(hud.totalGci)}   |   RISK-ADJ PIPELINE ${fmtMoney(hud.riskWeighted)}   |   BROKERAGE NET ${fmtMoney(hud.brokerageNet)}   |   ${filtered.length} DEALS`;
      pdf.text(summary, 48, 50);

      const availH = ph - HEAD - 28;
      const ratio = Math.min(pw / canvas.width, availH / canvas.height);
      pdf.addImage(img, "PNG", (pw - canvas.width * ratio) / 2, HEAD + 12, canvas.width * ratio, canvas.height * ratio);

      pdf.setTextColor(120, 120, 140); pdf.setFontSize(6.5);
      pdf.text(`CONFIDENTIAL · SPARK OS REAL ESTATE AI · usesparkai.app${synthesized ? " · CONTAINS SIMULATED ROWS" : ""}`, pw / 2, ph - 10, { align: "center" });

      pdf.setProperties({
        title: `SPARK OS Commission Audit - ${stamp.toISOString().slice(0, 10)}`,
        subject: "Brokerage commission audit and pro-forma cash flow",
        author: "SPARK OS Real Estate AI", creator: "SPARK OS Real Estate AI",
        keywords: "spark os, real estate ai, commission, ledger, cash flow, audit",
      });
      setExportPct(95);
      pdf.save(`SPARK_OS_COMMISSION_AUDIT_${stamp.toISOString().slice(0, 10)}.pdf`);
      setExportPct(100);
    } catch (err) {
      setError(`Tear-sheet export failed: ${err.message}`);
    } finally { setTimeout(() => { setExporting(false); setExportPct(0); }, 500); }
  }, [exporting, hud, filtered.length, synthesized]);

  if (loading) return <SparkBoot label="RECONCILING BROKERAGE LEDGER & FINANCIAL FORECASTS..." />;

  const selStat = selected ? STATUS_META[selected.status] : null;
  const selectStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #27272a", borderRadius: 8,
    color: "#fff", fontFamily: F, fontSize: 11, padding: "8px 10px", outline: "none", cursor: "pointer",
  };

  return (
    <div ref={rootRef}
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6 overflow-y-auto"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 16, boxSizing: "border-box", overflowY: "auto",
      }}>
      <style>{`@keyframes clSpin{to{transform:rotate(360deg)}}`}</style>

      {toast && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 60,
            background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: `1px solid ${toast.includes("failed") || toast.includes("unavailable") ? RED : PURPLE}88`,
            borderRadius: 10, padding: "11px 20px", color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700,
            boxShadow: "none", whiteSpace: "nowrap",
          }}>{toast}</motion.div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <DollarSign size={20} color={GREEN} style={{ filter: "none"}} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1.4, color: "#fff" }}>COMMISSION LEDGER</div>
          <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, color: SLATE_DIM, letterSpacing: 2 }}>
            FINANCIAL COMMAND CENTER — {filtered.length} OF {deals.length} POSITIONS
          </div>
        </div>
        {synthesized && (
          <span className="font-mono" style={{
            fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: AMBER,
            background: `${AMBER}14`, border: `1px solid ${AMBER}66`, borderRadius: 999,
            padding: "5px 12px", boxShadow: "none",
          }}>⚠ SIMULATED LEDGER · SPARSE LIVE DATA</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={exportCsv} disabled={!filtered.length}
            style={{
              display: "flex", alignItems: "center", gap: 7, background: "rgba(34,197,94,0.13)",
              border: `1px solid ${GREEN}66`, borderRadius: 9, padding: "9px 14px", color: GREEN,
              fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase",
              cursor: filtered.length ? "pointer" : "default", opacity: filtered.length ? 1 : 0.5, whiteSpace: "nowrap",
            }}><Download size={12} /> Export CSV</button>
          <button onClick={exportPdf} disabled={exporting}
            style={{
              position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 7,
              background: exporting ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.18)",
              border: `1px solid ${PURPLE}77`, borderRadius: 9, padding: "9px 14px", color: PURPLE_LT,
              fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase",
              cursor: exporting ? "default" : "pointer", boxShadow: "none", whiteSpace: "nowrap",
            }}>
            {exporting ? <Loader2 size={12} style={{ animation: "clSpin 1s linear infinite" }} /> : <FileDown size={12} />}
            {exporting ? `Generating… ${exportPct}%` : "PDF Tear-Sheet"}
            {exporting && <span style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${exportPct}%`, background: PURPLE_LT, boxShadow: "none", transition: "width .3s ease" }} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px" }}>{error}</div>
      )}

      {/* Predictive Financial HUD */}
      <div style={{ display: "flex", gap: 12 }}>
        <MetricCard icon={TrendingUp} label="90-Day Liquidity Forecast" value={hud.liquidity} format={fmtMoney}
          accent={CYAN} spark={spark} delta={hud.mom} deltaLabel="next-30 vs 30-60" />
        <MetricCard icon={DollarSign} label="Total Filtered GCI" value={hud.totalGci} format={fmtMoney}
          accent={GREEN} spark={spark} />
        <MetricCard icon={Gauge} label="Risk-Adjusted Pipeline" value={hud.riskWeighted} format={fmtMoney}
          accent={PURPLE} spark={spark} delta={hud.slippage} deltaLabel="vs stated GCI" />
        <MetricCard icon={Wallet} label="Brokerage Net Realized" value={hud.brokerageNet} format={fmtMoney}
          accent={AMBER} spark={spark} />
      </div>

      {/* Cash flow / waterfall visualizer */}
      <div className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: "1px solid #27272a", borderRadius: 14, padding: 16, height: 292, flexShrink: 0,
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
            Predictive Cash Flow
          </span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => setView(v.id)} className="font-mono"
                style={{
                  fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.8, padding: "6px 11px",
                  borderRadius: 7, cursor: "pointer", textTransform: "uppercase",
                  background: view === v.id ? `${PURPLE}22` : "transparent",
                  border: `1px solid ${view === v.id ? PURPLE : "#27272a"}`,
                  color: view === v.id ? PURPLE_LT : SLATE_DIM,
                  boxShadow: "none",
                }}>{v.label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {chartData.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: SLATE_DIM }}>NO POSITIONS IN RANGE</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="clConfirmed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PURPLE} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="clWeighted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CYAN} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.22)" tick={{ fill: "#71717a", fontSize: 9.5, fontFamily: MONO }} />
                <YAxis yAxisId="l" stroke="rgba(255,255,255,0.22)" tick={{ fill: "#71717a", fontSize: 9.5, fontFamily: MONO }} tickFormatter={fmtMoney} />
                <YAxis yAxisId="r" orientation="right" stroke="rgba(255,255,255,0.14)" tick={{ fill: "#71717a", fontSize: 9, fontFamily: MONO }} tickFormatter={fmtMoney} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: "#18181b" }} />
                <Legend wrapperStyle={{ fontFamily: F, fontSize: 9.5, color: SLATE_DIM }} />
                <Bar yAxisId="l" dataKey="confirmed" stackId="a" name={view === "waterfall" ? "Agent Payout" : "Confirmed GCI"}
                  fill="url(#clConfirmed)" isAnimationActive={false} radius={[0, 0, 0, 0]} />
                <Bar yAxisId="l" dataKey="weighted" stackId="a" name={view === "waterfall" ? "Brokerage Net" : "Prob-Weighted GCI"}
                  fill="url(#clWeighted)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="net" name="Brokerage Net Cash Flow" stroke={GREEN} strokeWidth={2}
                  isAnimationActive={false} dot={{ r: 3, fill: GREEN, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Filter suite */}
      <div className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: "1px solid #27272a", borderRadius: 12, padding: 12,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0,
        }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search size={13} color={SLATE_DIM} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search address or agent…"
            style={{
              width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)",
              border: "1px solid #27272a", borderRadius: 8, color: "#fff",
              fontFamily: F, fontSize: 11, padding: "8px 10px 8px 30px", outline: "none",
            }} />
        </div>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Agents</option>
          {agentOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <select value={bracketFilter} onChange={(e) => setBracketFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Values</option>
          <option value="1m">$1M+</option><option value="5m">$5M+</option><option value="10m">$10M+</option>
        </select>
      </div>

      {/* Ledger + Audit drawer */}
      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 300 }}>
        <div className="backdrop-blur-2xl bg-black/60 border border-white/10"
          style={{
            flex: selected ? "1 1 62%" : "1 1 100%", background: "#111111",
            backdropFilter: "none", WebkitBackdropFilter: "none",
            border: "1px solid #27272a", borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", transition: "flex .28s ease",
          }}>
          <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 10 }}>
            Ledger Matrix
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr 0.9fr 0.8fr 0.7fr 0.9fr 0.7fr 1fr 0.9fr 0.6fr", gap: 7, padding: "0 8px 8px", borderBottom: "1px solid #27272a" }}>
            {[["agent", "Agent"], ["property", "Property"], ["volume", "Volume"], ["gci", "Total GCI"], ["agentPayoutPercent", "Split %"], ["brokerageNet", "Brok. Net"], ["probability", "Prob %"], ["projectedCloseDate", "Proj. Close"], ["status", "Status"], [null, "Action"]].map(([k, label]) => (
              <button key={label} onClick={() => k && toggleSort(k)} disabled={!k}
                style={{
                  background: "transparent", border: "none", padding: 0, textAlign: "left",
                  cursor: k ? "pointer" : "default", display: "flex", alignItems: "center", gap: 3,
                  fontFamily: F, fontSize: 7.5, fontWeight: 800, letterSpacing: 1,
                  color: sortKey === k ? PURPLE_LT : SLATE_DIM, textTransform: "uppercase",
                }}>{label}{k && <ArrowUpDown size={8} style={{ opacity: sortKey === k ? 1 : 0.35 }} />}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 22, textAlign: "center", fontFamily: F, fontSize: 12, color: SLATE_DIM }}>
                {deals.length === 0 ? "No deals found for this brokerage." : "No deals match the current filters."}
              </div>
            ) : filtered.map((d) => {
              const isSel = selected?.id === d.id;
              const adj = riskAdjust(d);
              return (
                <div key={d.id} onClick={() => setSelected(d)}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1.7fr 0.9fr 0.8fr 0.7fr 0.9fr 0.7fr 1fr 0.9fr 0.6fr", gap: 7,
                    alignItems: "center", padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer", background: isSel ? `${PURPLE}14` : "transparent",
                    borderLeft: `2px solid ${isSel ? PURPLE : "transparent"}`, transition: "background .15s ease",
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "#18181b"; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.agent}</span>
                    {d.synthetic && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 6.5, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 3px", flexShrink: 0 }}>SIM</span>}
                  </span>
                  <span style={{ fontFamily: F, fontSize: 11, color: SLATE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.property}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: "#fff" }}>{fmtMoney(d.volume)}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: GREEN }}>{fmtMoney(d.gci)}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: SLATE }}>{d.agentPayoutPercent}%</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: PURPLE_LT }}>{fmtMoney(d.brokerageNet)}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: adj.penalty > 0 ? AMBER : SLATE }}>{adj.adjusted}%</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10, color: SLATE_DIM }}>{fmtDate(d.projectedCloseDate)}</span>
                  <span><StatusPill status={d.status} /></span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: CYAN }}>[ AUDIT ]</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Commission Audit Dossier — rendered directly (no presence wrapper) */}
        {selected && audit && (
          <div className="backdrop-blur-2xl bg-black/60 border border-white/10"
            style={{
              flex: "1 1 38%", background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
              border: "1px solid #27272a", borderRadius: 14, padding: 16,
              display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Wallet size={13} color={PURPLE_LT} />
              <span className="tracking-wider" style={{ fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: 1.8, color: PURPLE_LT, textTransform: "uppercase" }}>
                Commission Audit Dossier
              </span>
              <button onClick={() => setSelected(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={15} /></button>
            </div>

            <div style={{ border: `1px solid ${selStat.color}44`, borderRadius: 11, padding: 13, marginBottom: 12, background: "#18181b" }}>
              <div style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, color: "#fff", marginBottom: 4, lineHeight: 1.35 }}>{selected.property}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: F, fontSize: 11, color: SLATE_DIM }}>{selected.agent}</span>
                {selected.synthetic && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "1px 5px" }}>SIMULATED</span>}
                <span style={{ marginLeft: "auto" }}><StatusPill status={selected.status} /></span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[["Volume", fmtMoney(selected.volume), "#fff"], ["Total GCI", fmtMoney(selected.gci), GREEN], ["Risk-Adj", `${audit.adjusted}%`, audit.penalty ? AMBER : CYAN]].map(([l, v, c]) => (
                  <div key={l}>
                    <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                    <div className="font-mono" style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tiered split calculation */}
            <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.5, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 7 }}>
              Tiered Split Calculation
            </div>
            <div style={{ border: "1px solid #27272a", borderRadius: 10, padding: 12, marginBottom: 12, background: "#18181b" }}>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 11, color: PURPLE_LT, fontWeight: 800, marginBottom: 8 }}>
                {selected.agentPayoutPercent}/{100 - selected.agentPayoutPercent} SPLIT → {fmtFull(CAP_TARGET)} CAP
              </div>
              {[["Agent Gross", fmtFull(audit.agentGross), GREEN],
                ["Desk Fee", `− ${fmtFull(DESK_FEE)}`, SLATE_DIM],
                ["Transaction Fee", `− ${fmtFull(TXN_FEE)}`, SLATE_DIM],
                ["Agent Net", fmtFull(audit.agentNet), "#fff"],
                ["Company Dollar", fmtFull(audit.companyDollar), PURPLE_LT],
                ["Brokerage Net", fmtFull(selected.brokerageNet), AMBER]].map(([l, v, c], i, arr) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: i === 3 || i === 4 ? "1px solid #27272a" : "none" }}>
                  <span style={{ fontFamily: F, fontSize: 10, color: SLATE_DIM }}>{l}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, fontWeight: i === 3 || i === 5 ? 800 : 600, color: c }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span className="tracking-wider" style={{ fontFamily: F, fontSize: 8, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase" }}>Cap Progress</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: audit.capPct >= 100 ? GREEN : CYAN }}>
                    {fmtFull(audit.capPaid)} · {audit.capPct.toFixed(0)}% Completed
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "#27272a", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${audit.capPct}%`, transition: "width .6s ease", background: `${PURPLE}`, boxShadow: "none"}} />
                </div>
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: SLATE_DIM, marginTop: 8, letterSpacing: 0.4 }}>
                CAP / DESK FEE / TXN FEE ARE DESK CONVENTIONS — NOT DB COLUMNS
              </div>
            </div>

            {/* AI cash flow risk flag */}
            {audit.flag && (
              <div style={{ border: `1px solid ${AMBER}55`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, background: `#111111` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <ShieldAlert size={11} color={AMBER} />
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.4, color: AMBER }}>AI CASH FLOW RISK FLAG</span>
                </div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 10, color: SLATE, lineHeight: 1.5 }}>{audit.flag}</div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, marginTop: 5 }}>
                  {selected.probability}% stated → {audit.adjusted}% adjusted · weighted value {fmtFull(selected.gci * audit.adjusted / 100)}
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid #27272a", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={approvePayout} disabled={approving || selected.status === "CLOSED"}
                style={{
                  width: "100%", background: selected.status === "CLOSED" ? "rgba(255,255,255,0.05)" : "rgba(34,197,94,0.16)",
                  border: `1px solid ${selected.status === "CLOSED" ? "rgba(255,255,255,0.15)" : GREEN}77`, borderRadius: 10,
                  padding: "11px 14px", fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: selected.status === "CLOSED" ? SLATE_DIM : GREEN,
                  cursor: approving || selected.status === "CLOSED" ? "default" : "pointer",
                  boxShadow: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {approving ? <Loader2 size={12} style={{ animation: "clSpin 1s linear infinite" }} /> : <CheckCircle2 size={12} />}
                {selected.status === "CLOSED" ? "Payout Released" : approving ? "Releasing…" : "[ Approve Payout Release ]"}
              </button>
              <button onClick={exportStatement}
                style={{
                  width: "100%", background: "rgba(168,85,247,0.16)", border: `1px solid ${PURPLE}77`, borderRadius: 10,
                  padding: "11px 14px", fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: PURPLE_LT, cursor: "pointer", boxShadow: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <Download size={12} /> [ Export Statement ]
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
