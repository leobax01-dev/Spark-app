// src/features/TransactionIntelligence.jsx — SPARK OS Transaction Intelligence
// & Lifecycle Command Terminal.
//
// The Deals page, rebuilt as a full-bleed pipeline terminal: a telemetry HUD,
// a dual-view command board (kanban / master table), and a slide-over dossier
// carrying hard-stop contingency timers, the stakeholder dock, document
// intake, a net-sheet engine and the collateral bridges.
//
// Standing adaptations, same rationale as every other SPARK OS terminal:
//
// 1. Styling: no Tailwind is configured in this app — requested className
//    strings are kept (free upgrade if Tailwind ever lands) and backed by
//    equivalent inline styles. Breakpoints that the layout genuinely depends
//    on are measured against the CONTAINER, since this panel renders beside a
//    ~250px sidebar.
//
// 2. Animation: framer-motion is used ONLY for imperative value tickers. The
//    dossier slide is a CSS transition — a framer-motion entrance on it stalled
//    mid-slide in testing and left the panel hanging half off-screen. Nothing
//    is gated behind an animation; a stalled one would hide a deadline.
//
// 3. Data model. Agent deals live in localStorage `spark_pipeline_value_v1`
//    as {id,name,value,probability,stage,closeDate} — free-text stage, and no
//    contingency dates, stakeholders or net-sheet inputs. Those extra fields
//    are stored alongside in `spark_txn_detail_v1`, keyed by deal id, rather
//    than inventing columns on a shape other screens already read.
//
// 4. Bridge honesty (see §6 of the brief):
//    - Client link and the collateral bridges are real: they navigate and
//      seed the target tool's own store.
//    - Autopilot dispatch is real: deadlines write to
//      `spark_autopilot_alerts_v1`, which features/briefing.js folds into
//      Panel A of the Command Matrix.
//    - Brokerage sync is PARTIAL and says so on screen. The Commission Ledger
//      and Executive Overview read the Supabase `deals` table; agent deals
//      created here live in localStorage and have no row there. A stage change
//      updates Supabase only for deals carrying `supabaseId`; everything else
//      is queued in an outbox and labelled as not yet transmitted, because
//      claiming a broker-side update that never happened would corrupt the
//      brokerage's numbers in exactly the place they are trusted most.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "framer-motion";
import {
  Zap, X, Search, LayoutGrid, Table2, Clock, AlertTriangle, TrendingUp,
  DollarSign, Users, ChevronRight, ChevronDown, ChevronUp, FileText, Download,
  Send, CheckCircle2, Loader2, Building2, Phone, Mail, ArrowUpDown, Link2,
  Presentation, LineChart, Upload,
} from "lucide-react";
import { lsGet, lsSet, cloudSync } from "../utils/storage";
import { AUTOPILOT_ALERTS_KEY } from "./briefing";

// ── design tokens ─────────────────────────────────────────────────────────
const BG = "#050505";
const CYAN = "#22d3ee";
const PURPLE = "#a855f7";
const PURPLE_LT = "#c084fc";
const AMBER = "#ffb020";
const RED = "#ff3b5c";
const GREEN = "#22c55e";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";
// Hex twin of the slate tokens. Anywhere a colour gets an alpha suffix
// (`${color}1e`) it MUST be 6-digit hex — appending to an rgba() string
// produces invalid CSS that the browser drops, which rendered the "All"
// filter chip as an unreadable white box.
const SLATE_HEX = "#94a3b8";
const HAIRLINE = "rgba(255,255,255,0.1)";
const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const DEALS_KEY = "spark_pipeline_value_v1";
const CLIENTS_KEY = "spark_clients_v1";
const DETAIL_KEY = "spark_txn_detail_v1";
const OUTBOX_KEY = "spark_brokerage_outbox_v1";
const PRESENTATION_KEY = "spark_txn_presentation_v1";
const CMA_KEY = "spark_txn_cma_v1";

const GCI_RATE = 0.03;
const URGENT_HOURS = 72;
const CRITICAL_HOURS = 48;

const STAGES = [
  { id: "offer", label: "Offer Submitted", color: CYAN },
  { id: "contract", label: "Under Contract", color: PURPLE },
  { id: "diligence", label: "Due Diligence", color: AMBER },
  { id: "clear", label: "Clear to Close", color: "#38bdf8" },
  { id: "closed", label: "Closed / Paid", color: GREEN },
];
const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

// Existing deals carry free-text stages typed by the agent, so they are
// matched by keyword rather than assumed to be one of the five ids.
function canonicalStage(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "offer";
  if (STAGE_BY_ID[s]) return s;
  if (/clos|paid|sold|funded/.test(s)) return "closed";
  if (/clear|cleared to close|ctc|final/.test(s)) return "clear";
  if (/diligen|inspect|apprais|contingen/.test(s)) return "diligence";
  if (/contract|pending|escrow|accepted/.test(s)) return "contract";
  return "offer";
}

// ── formatting ────────────────────────────────────────────────────────────
function fmtMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}
function fmtFull(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString()}`;
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
function hoursUntil(d, now = Date.now()) {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now) / 3_600_000;
}
function daysUntil(d, now = Date.now()) {
  const h = hoursUntil(d, now);
  return h == null ? null : Math.ceil(h / 24);
}
function countdownLabel(d, now = Date.now()) {
  const h = hoursUntil(d, now);
  if (h == null) return "NO DATE";
  if (h < 0) return "PASSED";
  if (h < 48) return `${Math.floor(h)}h ${Math.floor((h % 1) * 60)}m`;
  return `${Math.ceil(h / 24)}d`;
}
function addDays(base, n) {
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── container breakpoints (no Tailwind build) ─────────────────────────────
function useContainerWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => { const r = e[0]?.contentRect; if (r) setW(r.width); });
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// ── ticker ────────────────────────────────────────────────────────────────
function useTicker(target, duration = 1.0) {
  const [shown, setShown] = useState(Number(target) || 0);
  const prev = useRef(Number(target) || 0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(target) || 0;
    prev.current = to;
    if (from === to) { setShown(to); return; }
    const c = animate(from, to, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown, onComplete: () => setShown(to),
    });
    return () => c.stop();
  }, [target, duration]);
  return shown;
}

// ── demo-safe synthesizer ─────────────────────────────────────────────────
// A sparse or empty pipeline gets three fully-populated Miami luxury
// transactions so the terminal is operational before real data exists.
// Every synthesized deal is badged SIM and never syncs anywhere.
function synthesizeDeals() {
  const today = new Date();
  const iso = (n) => addDays(today, n);
  return [
    {
      id: "sim-brickell", simulated: true, name: "1425 Brickell Ave #42B",
      value: 1_250_000, probability: 82, stage: "diligence", closeDate: iso(24),
      detail: {
        address: "1425 Brickell Ave #42B, Miami, FL 33131",
        clientName: "Daniel Reyes", side: "buyer",
        offerDate: iso(-11), inspectionDate: iso(2), appraisalDate: iso(9),
        loanCommitmentDate: iso(16), closeDate: iso(24),
        stakeholders: {
          escrow: { name: "Marisol Vega", org: "Sunshine Title", contact: "305-555-0141", status: "Escrow opened · EMD received", updatedAt: iso(-9) },
          lender: { name: "Andre Cole", org: "First Coast Lending", contact: "305-555-0188", status: "Underwriting — conditions out", updatedAt: iso(-2) },
          coop: { name: "Priya Raman", org: "Compass", contact: "786-555-0119", status: "Responsive", updatedAt: iso(-3) },
          inspector: { name: "Hector Diaz", org: "Bayside Inspections", contact: "305-555-0166", status: "Scheduled", updatedAt: iso(-1) },
        },
        netSheet: { commissionPct: 5, annualTax: 18_400, loanPayoff: 0, downPct: 25, earnest: 62_500 },
      },
    },
    {
      id: "sim-star", simulated: true, name: "42 Star Island Dr",
      value: 3_800_000, probability: 71, stage: "contract", closeDate: iso(46),
      detail: {
        address: "42 Star Island Dr, Miami Beach, FL 33139",
        clientName: "Whitmore Family Trust", side: "seller",
        offerDate: iso(-4), inspectionDate: iso(1), appraisalDate: iso(18),
        loanCommitmentDate: iso(30), closeDate: iso(46),
        stakeholders: {
          escrow: { name: "Tom Bassett", org: "Atlantic Title", contact: "305-555-0173", status: "Awaiting signed addendum", updatedAt: iso(-1) },
          lender: { name: "Renata Sousa", org: "Buyer-side · Truist", contact: "786-555-0102", status: "Pre-approval on file", updatedAt: iso(-4) },
          coop: { name: "Gregory Nunn", org: "Douglas Elliman", contact: "305-555-0154", status: "Slow to respond — 2 unanswered", updatedAt: iso(-5) },
          inspector: { name: "Not yet assigned", org: "—", contact: "—", status: "Buyer selecting", updatedAt: null },
        },
        netSheet: { commissionPct: 5.5, annualTax: 61_200, loanPayoff: 1_140_000, downPct: 30, earnest: 190_000 },
      },
    },
    {
      id: "sim-grove", simulated: true, name: "3781 Leafy Way",
      value: 6_200_000, probability: 64, stage: "offer", closeDate: iso(67),
      detail: {
        address: "3781 Leafy Way, Coconut Grove, FL 33133",
        clientName: "Aurelia Fonseca", side: "seller",
        offerDate: iso(-1), inspectionDate: iso(12), appraisalDate: iso(26),
        loanCommitmentDate: iso(44), closeDate: iso(67),
        stakeholders: {
          escrow: { name: "Pending selection", org: "—", contact: "—", status: "Not opened", updatedAt: null },
          lender: { name: "Cash buyer", org: "—", contact: "—", status: "Proof of funds verified", updatedAt: iso(-1) },
          coop: { name: "Simone Achebe", org: "ONE Sotheby's", contact: "305-555-0197", status: "Negotiating terms", updatedAt: iso(-1) },
          inspector: { name: "Not yet assigned", org: "—", contact: "—", status: "—", updatedAt: null },
        },
        netSheet: { commissionPct: 5, annualTax: 94_800, loanPayoff: 2_050_000, downPct: 100, earnest: 310_000 },
      },
    },
  ];
}

// ── net sheet engine ──────────────────────────────────────────────────────
// Estimates only. Florida doc stamps run $0.70 per $100 of consideration
// outside Miami-Dade; title/escrow and lender fees vary by provider. This is
// a planning tool, never a settlement statement, and says so on screen.
function computeNetSheet(price, ns = {}, closeDate) {
  const p = Number(price) || 0;
  const commissionPct = Number(ns.commissionPct) || 5;
  const annualTax = Number(ns.annualTax) || 0;
  const payoff = Number(ns.loanPayoff) || 0;
  const downPct = Number(ns.downPct) || 20;
  const earnest = Number(ns.earnest) || 0;

  const commission = p * (commissionPct / 100);
  const docStamps = p * 0.007;
  const titleEscrow = p * 0.005 + 750;

  // Seller owes taxes for the portion of the year they held the property.
  const close = closeDate ? new Date(closeDate) : new Date();
  const yearStart = new Date(close.getFullYear(), 0, 1);
  const dayOfYear = Math.max(1, Math.round((close - yearStart) / 86_400_000));
  const sellerTaxShare = annualTax * (dayOfYear / 365);
  const buyerTaxShare = annualTax - sellerTaxShare;

  const sellerNet = p - commission - docStamps - titleEscrow - sellerTaxShare - payoff;

  const down = p * (downPct / 100);
  const loanAmount = Math.max(0, p - down);
  const lenderFees = loanAmount > 0 ? loanAmount * 0.01 + 1_800 : 0;
  const buyerTitle = p * 0.0035 + 600;
  const prepaids = buyerTaxShare + (loanAmount > 0 ? 2_400 : 0);
  const cashToClose = down + lenderFees + buyerTitle + prepaids - earnest;

  return {
    price: p, commissionPct, commission, docStamps, titleEscrow,
    sellerTaxShare, buyerTaxShare, payoff, sellerNet,
    down, downPct, loanAmount, lenderFees, buyerTitle, prepaids, earnest, cashToClose,
    agentGci: p * GCI_RATE,
  };
}

// ── contingency model ─────────────────────────────────────────────────────
const CONTINGENCIES = [
  { key: "inspectionDate", label: "Inspection Period" },
  { key: "appraisalDate", label: "Appraisal Contingency" },
  { key: "loanCommitmentDate", label: "Loan Commitment" },
  { key: "closeDate", label: "Closing Date" },
];

function dealHealth(deal, now = Date.now()) {
  const d = deal.detail || {};
  const soon = CONTINGENCIES.filter((c) => {
    const h = hoursUntil(d[c.key], now);
    return h != null && h >= 0 && h <= CRITICAL_HOURS;
  }).length;
  const passed = CONTINGENCIES.filter((c) => {
    const h = hoursUntil(d[c.key], now);
    return h != null && h < 0 && c.key !== "closeDate";
  }).length;
  const prob = Number(deal.probability) || 50;
  if (passed > 0 || soon > 1) return { tone: "critical", color: RED, label: "Critical" };
  if (soon === 1 || prob < 55) return { tone: "watch", color: AMBER, label: "Watch" };
  return { tone: "healthy", color: GREEN, label: "On track" };
}

// ── HUD card ──────────────────────────────────────────────────────────────
function HudCard({ label, value, sub, color, format = "money", pulse, icon: I }) {
  const shown = useTicker(value);
  const text = format === "pct" ? `${Math.round(shown)}%`
    : format === "int" ? `${Math.round(shown)}`
      : fmtMoney(shown);
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      minWidth: 0, padding: 15, borderRadius: 13,
      background: `linear-gradient(135deg,${color}0e,rgba(0,0,0,0.45))`,
      backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
      border: `1px solid ${color}33`,
      animation: pulse ? "tiPulseBorder 1.8s ease-in-out infinite" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        {I && <I size={11} color={color} />}
        <span className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.5,
          color: SLATE_DIM, textTransform: "uppercase",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>[ {label} ]</span>
      </div>
      <div className="font-mono" style={{
        fontFamily: MONO, fontSize: 25, fontWeight: 800, color,
        textShadow: `0 0 18px ${color}66`, lineHeight: 1.1,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{text}</div>
      <div style={{ fontFamily: F, fontSize: 9.5, color: SLATE_DIM, marginTop: 4, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

// ── deal card (kanban) ────────────────────────────────────────────────────
function DealCard({ deal, now, onOpen, onClient }) {
  const health = dealHealth(deal, now);
  const d = deal.detail || {};
  const days = daysUntil(d.closeDate || deal.closeDate, now);
  return (
    <div onClick={() => onOpen(deal)}
      className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
        padding: 12, borderRadius: 11, marginBottom: 9, cursor: "pointer",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
        border: `1px solid ${HAIRLINE}`, transition: "border-color .16s ease",
      }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 8 }}>
        <span style={{ position: "relative", width: 7, height: 7, flexShrink: 0, marginTop: 4 }}>
          <span style={{
            position: "absolute", inset: -3, borderRadius: "50%", border: `1px solid ${health.color}`,
            animation: "tiPulse 2.2s cubic-bezier(.2,.6,.4,1) infinite",
          }} />
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: health.color, boxShadow: `0 0 7px ${health.color}` }} />
        </span>
        <div style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 11.5, fontWeight: 700, color: "#fff", lineHeight: 1.35 }}>
          {d.address || deal.name}
        </div>
        {deal.simulated && (
          <span className="font-mono" style={{ fontFamily: MONO, fontSize: 6.5, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>SIM</span>
        )}
      </div>

      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
        {fmtMoney(deal.value)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {d.clientName && (
          <button onClick={(e) => { e.stopPropagation(); onClient(d.clientName); }}
            title={`Open ${d.clientName} in Clients`}
            style={{
              display: "flex", alignItems: "center", gap: 4, maxWidth: "100%",
              background: `${CYAN}14`, border: `1px solid ${CYAN}55`, borderRadius: 999,
              padding: "3px 8px", cursor: "pointer", color: CYAN,
              fontFamily: F, fontSize: 9, fontWeight: 700, minWidth: 0,
            }}>
            <Link2 size={8} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.clientName}</span>
          </button>
        )}
        <span className="font-mono" style={{
          marginLeft: "auto", fontFamily: MONO, fontSize: 9, fontWeight: 700,
          color: days != null && days <= 7 ? AMBER : SLATE_DIM, flexShrink: 0,
        }}>
          <Clock size={8} style={{ verticalAlign: -1, marginRight: 3 }} />
          {days == null ? "—" : days < 0 ? "PASSED" : `${days}d`}
        </span>
      </div>
    </div>
  );
}

// ── contingency timer bar ─────────────────────────────────────────────────
function ContingencyBar({ label, date, offerDate, now, onDispatch, dispatched }) {
  const h = hoursUntil(date, now);
  const critical = h != null && h >= 0 && h <= CRITICAL_HOURS;
  const passed = h != null && h < 0;
  const color = passed ? SLATE_DIM : critical ? RED : h != null && h <= URGENT_HOURS ? AMBER : CYAN;

  // Progress runs from the offer date to the deadline, so the bar reflects
  // elapsed contract time rather than an arbitrary fixed window.
  let pct = 0;
  if (date && offerDate) {
    const start = new Date(offerDate).getTime();
    const end = new Date(date).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    }
  }

  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span className="tracking-wider" style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: 1.2, color: SLATE_DIM,
          textTransform: "uppercase", flex: 1, minWidth: 0,
        }}>{label}</span>
        <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, flexShrink: 0 }}>
          {fmtDate(date)}
        </span>
        <span className="font-mono" style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 800, color, flexShrink: 0, minWidth: 58, textAlign: "right",
          animation: critical ? "tiBlink 1.1s ease-in-out infinite" : "none",
        }}>{countdownLabel(date, now)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color,
          boxShadow: `0 0 8px ${color}`, transition: "width .4s ease",
        }} />
      </div>
      {critical && (
        <button onClick={() => onDispatch(label, date)} disabled={dispatched}
          style={{
            width: "100%", marginTop: 7, padding: "8px 10px", borderRadius: 8,
            background: dispatched ? `${GREEN}18` : `${RED}1c`,
            border: `1px solid ${dispatched ? GREEN : RED}88`,
            color: dispatched ? GREEN : RED, cursor: dispatched ? "default" : "pointer",
            fontFamily: F, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            animation: dispatched ? "none" : "tiGlowRed 1.5s ease-in-out infinite",
          }}>
          {dispatched ? <CheckCircle2 size={11} /> : <Send size={11} />}
          {dispatched ? "Dispatched to Autopilot" : "[ Dispatch Urgent Reminder ]"}
        </button>
      )}
    </div>
  );
}

// ── stakeholder dock ──────────────────────────────────────────────────────
const STAKEHOLDER_ROLES = [
  { key: "escrow", label: "Escrow Officer", icon: Building2 },
  { key: "lender", label: "Lender", icon: DollarSign },
  { key: "coop", label: "Co-Op Agent", icon: Users },
  { key: "inspector", label: "Home Inspector", icon: Search },
];

function StakeholderDock({ stakeholders = {}, now }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {STAKEHOLDER_ROLES.map((r) => {
        const s = stakeholders[r.key] || {};
        const stale = s.updatedAt ? (now - new Date(s.updatedAt).getTime()) / 86_400_000 > 5 : true;
        const unassigned = !s.name || s.name === "—" || /not yet assigned|pending/i.test(s.name);
        const dot = unassigned ? SLATE_DIM : stale ? AMBER : GREEN;
        const I = r.icon;
        return (
          <div key={r.key} style={{
            padding: 11, borderRadius: 10, border: `1px solid ${HAIRLINE}`,
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <I size={11} color={SLATE_DIM} style={{ flexShrink: 0 }} />
              <span className="tracking-wider" style={{
                fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.3, color: SLATE_DIM,
                textTransform: "uppercase", flex: 1,
              }}>{r.label}</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, boxShadow: `0 0 6px ${dot}`, flexShrink: 0 }} />
            </div>
            <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: unassigned ? SLATE_DIM : "#fff" }}>
              {s.name || "Not assigned"}
              {s.org && s.org !== "—" && (
                <span style={{ fontWeight: 500, color: SLATE_DIM }}> · {s.org}</span>
              )}
            </div>
            {s.contact && s.contact !== "—" && (
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9.5, color: CYAN, marginTop: 3 }}>
                <Phone size={8} style={{ verticalAlign: -1, marginRight: 4 }} />{s.contact}
              </div>
            )}
            {s.status && s.status !== "—" && (
              <div style={{ fontFamily: F, fontSize: 10, color: SLATE, marginTop: 5, lineHeight: 1.45 }}>
                {s.status}
              </div>
            )}
            <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, marginTop: 4 }}>
              {s.updatedAt ? `UPDATED ${fmtDate(s.updatedAt)}` : "NO UPDATE LOGGED"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── net sheet ─────────────────────────────────────────────────────────────
function NetSheet({ deal, sheet, side, onSide, onExport, exporting }) {
  const rows = side === "seller"
    ? [
      ["Sale price", sheet.price, "#fff"],
      [`Commission (${sheet.commissionPct}%)`, -sheet.commission, RED],
      ["Doc stamps (est. 0.7%)", -sheet.docStamps, RED],
      ["Title & escrow (est.)", -sheet.titleEscrow, RED],
      ["Property tax proration", -sheet.sellerTaxShare, RED],
      ["Loan payoff", -sheet.payoff, RED],
    ]
    : [
      ["Purchase price", sheet.price, "#fff"],
      [`Down payment (${sheet.downPct}%)`, sheet.down, SLATE],
      ["Lender fees (est.)", sheet.lenderFees, SLATE],
      ["Title & recording (est.)", sheet.buyerTitle, SLATE],
      ["Prepaids & escrow setup", sheet.prepaids, SLATE],
      ["Earnest money credit", -sheet.earnest, GREEN],
    ];
  const total = side === "seller" ? sheet.sellerNet : sheet.cashToClose;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${HAIRLINE}`, marginBottom: 12 }}>
        {["seller", "buyer"].map((s) => (
          <button key={s} onClick={() => onSide(s)} className="font-mono" style={{
            flex: 1, padding: "7px 10px", borderRadius: 7, cursor: "pointer",
            fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
            background: side === s ? `${CYAN}1e` : "transparent",
            border: `1px solid ${side === s ? `${CYAN}88` : "transparent"}`,
            color: side === s ? CYAN : SLATE_DIM,
          }}>
            {s === "seller" ? "Seller Net" : "Buyer Cash to Close"}
          </button>
        ))}
      </div>

      <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, overflow: "hidden", marginBottom: 11 }}>
        {rows.map(([label, val, color]) => (
          <div key={label} className="font-mono" style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: MONO, fontSize: 10.5,
          }}>
            <span style={{ flex: 1, minWidth: 0, color: SLATE_DIM, fontFamily: F, fontSize: 11 }}>{label}</span>
            <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{fmtFull(val)}</span>
          </div>
        ))}
        <div className="font-mono" style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px",
          background: `${side === "seller" ? GREEN : CYAN}0d`,
          borderTop: `1px solid ${side === "seller" ? GREEN : CYAN}44`,
        }}>
          <span className="tracking-wider" style={{
            flex: 1, fontFamily: MONO, fontSize: 8.5, letterSpacing: 1.3, color: SLATE_DIM, textTransform: "uppercase",
          }}>{side === "seller" ? "Estimated net to seller" : "Estimated cash to close"}</span>
          <span style={{
            fontFamily: MONO, fontSize: 17, fontWeight: 800,
            color: side === "seller" ? GREEN : CYAN,
            textShadow: `0 0 14px ${side === "seller" ? GREEN : CYAN}66`,
          }}>{fmtFull(total)}</span>
        </div>
      </div>

      <div className="font-mono" style={{
        fontFamily: MONO, fontSize: 8, lineHeight: 1.6, color: AMBER,
        background: `${AMBER}0d`, border: `1px solid ${AMBER}40`, borderRadius: 8,
        padding: "8px 10px", marginBottom: 11,
      }}>
        ⚠ ESTIMATE ONLY — DOC STAMPS, TITLE, LENDER AND ESCROW FEES VARY BY COUNTY AND PROVIDER.
        THIS IS A PLANNING TOOL, NOT A SETTLEMENT STATEMENT. VERIFY AGAINST THE CLOSING DISCLOSURE.
      </div>

      <button onClick={onExport} disabled={exporting} style={{
        width: "100%", padding: "12px 14px", borderRadius: 10,
        background: exporting ? "rgba(255,255,255,0.05)" : `${CYAN}1c`,
        border: `1px solid ${CYAN}77`, color: CYAN, cursor: exporting ? "default" : "pointer",
        fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        {exporting ? <Loader2 size={12} style={{ animation: "tiSpin 1s linear infinite" }} /> : <Download size={12} />}
        {exporting ? "Building PDF…" : "[ Export PDF Net Sheet ]"}
      </button>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────
export default function TransactionIntelligence({
  user, isMobile, onNavigate, onOpenTool,
}) {
  const [booting, setBooting] = useState(true);
  const [deals, setDeals] = useState([]);
  const [clients, setClients] = useState([]);
  const [view, setView] = useState("kanban");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [side, setSide] = useState("seller");
  const [now, setNow] = useState(Date.now());
  const [dispatched, setDispatched] = useState([]);
  const [sort, setSort] = useState({ col: "closeDate", dir: "asc" });
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncNote, setSyncNote] = useState(null);

  const rootRef = useRef(null);
  const cw = useContainerWidth(rootRef);
  const wide = cw === 0 || cw >= 900;   // lg: 5-col kanban
  const mid = cw === 0 || cw >= 620;    // sm/md: 2-col HUD

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);


  // Contingency countdowns are shown to the minute inside the dossier, so the
  // clock only ticks while a dossier is open — no point re-rendering the whole
  // board every second for day-granularity cards.
  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [selected]);

  // ── load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = lsGet(DEALS_KEY, []) || [];
    const detail = lsGet(DETAIL_KEY, {}) || {};
    const cl = lsGet(CLIENTS_KEY, []) || [];
    setClients(cl);

    const merged = raw.map((d) => ({
      ...d,
      stage: canonicalStage(d.stage),
      detail: detail[d.id] || { address: d.name, closeDate: d.closeDate },
    }));

    // "Sparse" means fewer than 2 real deals — a single half-entered deal
    // makes an empty-looking board, which is the case the synthesizer exists
    // for. Real deals are always kept and shown alongside.
    setDeals(merged.length >= 2 ? merged : [...merged, ...synthesizeDeals()]);
    setDispatched(() => {
      try { return (JSON.parse(localStorage.getItem(AUTOPILOT_ALERTS_KEY) || "[]") || []).map((a) => a.id); }
      catch { return []; }
    });
    setBooting(false);
  }, []);

  const persistDetail = useCallback((dealId, patch) => {
    const all = lsGet(DETAIL_KEY, {}) || {};
    const next = { ...all, [dealId]: { ...(all[dealId] || {}), ...patch } };
    lsSet(DETAIL_KEY, next);
    setDeals((ds) => ds.map((d) => d.id === dealId ? { ...d, detail: { ...d.detail, ...patch } } : d));
    setSelected((s) => s && s.id === dealId ? { ...s, detail: { ...s.detail, ...patch } } : s);
    if (user?.email) cloudSync(user.email, { transactions: { detail: next } });
  }, [user]);

  // ── §6 Autopilot dispatch — real write the Command Matrix reads ─────────
  const dispatchAlert = useCallback((deal, label, date) => {
    const id = `${deal.id}:${label}`;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(AUTOPILOT_ALERTS_KEY) || "[]") || []; } catch { list = []; }
    if (list.some((a) => a.id === id)) { setToast("Already dispatched to Autopilot."); return; }
    const addr = deal.detail?.address || deal.name;
    list.push({
      id, dueAt: new Date(date).toISOString(), severity: "critical",
      kind: "CONTINGENCY DEADLINE",
      // A deadline dispatched off a synthesized deal is itself synthesized.
      // Letting it reach the Autopilot HUD unbadged would put a fabricated
      // GCI exposure on the agent's homepage as though it were real.
      simulated: !!deal.simulated,
      subject: `${label} on ${addr} expires in ${countdownLabel(date)}`,
      detail: `Hard-stop contract date. ${fmtMoney(deal.value)} transaction, ${fmtFull(deal.value * GCI_RATE)} projected GCI at ${GCI_RATE * 100}%.`,
      action: `Confirm a written position with all parties before ${fmtDate(date)}.`,
      value: Math.round(deal.value * GCI_RATE),
      dispatchedAt: new Date().toISOString(),
    });
    localStorage.setItem(AUTOPILOT_ALERTS_KEY, JSON.stringify(list));
    setDispatched((d) => [...d, id]);
    setToast("Urgent reminder dispatched to your Autopilot HUD.");
  }, []);

  // ── §6 Brokerage sync — real where possible, queued and labelled where not ─
  const syncBrokerage = useCallback(async (deal, nextStage) => {
    const entry = {
      dealId: deal.id, address: deal.detail?.address || deal.name,
      value: Number(deal.value) || 0, gci: (Number(deal.value) || 0) * GCI_RATE,
      stage: nextStage, at: new Date().toISOString(), transmitted: false,
    };
    const sb = window.__supabase;
    // Only deals that originated in the brokerage's Supabase table have a row
    // to update. Locally-created agent deals do not, and inventing one would
    // put unverified numbers into the Commission Ledger.
    if (sb && deal.supabaseId) {
      try {
        const { error } = await sb.from("deals")
          .update({ stage: nextStage === "closed" ? "closed" : "contract", last_activity_at: new Date().toISOString() })
          .eq("id", deal.supabaseId);
        if (!error) entry.transmitted = true;
      } catch { /* falls through to the queued path below */ }
    }
    const outbox = lsGet(OUTBOX_KEY, []) || [];
    lsSet(OUTBOX_KEY, [...outbox, entry]);
    setSyncNote(entry.transmitted
      ? `Stage synced to the brokerage ledger.`
      : `Stage saved locally. Not transmitted to the brokerage ledger — this deal has no brokerage record.`);
    setTimeout(() => setSyncNote(null), 6000);
  }, []);

  const changeStage = useCallback((deal, nextStage) => {
    const raw = lsGet(DEALS_KEY, []) || [];
    const next = raw.map((d) => d.id === deal.id ? { ...d, stage: nextStage } : d);
    if (!deal.simulated) {
      lsSet(DEALS_KEY, next);
      if (user?.email) cloudSync(user.email, { pipeline: next });
    }
    setDeals((ds) => ds.map((d) => d.id === deal.id ? { ...d, stage: nextStage } : d));
    setSelected((s) => s && s.id === deal.id ? { ...s, stage: nextStage } : s);
    if (deal.simulated) { setSyncNote("Simulated deal — nothing was written or transmitted."); setTimeout(() => setSyncNote(null), 5000); return; }
    syncBrokerage(deal, nextStage);
  }, [user, syncBrokerage]);

  // ── §6 Client interlink ─────────────────────────────────────────────────
  const openClient = useCallback((name) => {
    const match = clients.find((c) => c.name?.toLowerCase() === String(name).toLowerCase());
    if (match) {
      try { localStorage.setItem("spark_focus_client_id", match.id); } catch { /* non-fatal */ }
      onNavigate?.("clients");
    } else {
      setToast(`${name} isn't in your Clients list yet — add them to link this deal.`);
    }
  }, [clients, onNavigate]);

  // ── §5E collateral bridges ──────────────────────────────────────────────
  const bridgeTo = useCallback((tool, deal) => {
    const d = deal.detail || {};
    if (tool === "presentation") {
      const cur = lsGet(PRESENTATION_KEY, {}) || {};
      lsSet(PRESENTATION_KEY, { ...cur, address: d.address || deal.name, askingPrice: String(deal.value || "") });
    } else {
      const cur = lsGet(CMA_KEY, {}) || {};
      lsSet(CMA_KEY, { ...cur, address: d.address || deal.name });
    }
    onOpenTool?.(tool);
  }, [onOpenTool]);

  // ── PDF net sheet ───────────────────────────────────────────────────────
  const exportNetSheet = useCallback(async (deal, sheet) => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth();
      const addr = deal.detail?.address || deal.name;

      doc.setFillColor(5, 5, 5); doc.rect(0, 0, W, 74, "F");
      doc.setFillColor(168, 85, 247); doc.rect(0, 70, W, 4, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
      doc.text("SPARK OS REAL ESTATE AI", 40, 33);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(190, 190, 200);
      doc.text(side === "seller" ? "Estimated Seller Net Sheet" : "Estimated Buyer Cash to Close", 40, 52);

      let y = 108;
      doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text(addr, 40, y); y += 20;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 90, 100);
      doc.text(`Closing ${fmtDate(deal.detail?.closeDate || deal.closeDate)}  -  Generated ${new Date().toLocaleString()}`, 40, y);
      y += 26;

      const rows = side === "seller"
        ? [["Sale price", sheet.price], [`Commission (${sheet.commissionPct}%)`, -sheet.commission],
        ["Doc stamps (est. 0.7%)", -sheet.docStamps], ["Title & escrow (est.)", -sheet.titleEscrow],
        ["Property tax proration", -sheet.sellerTaxShare], ["Loan payoff", -sheet.payoff]]
        : [["Purchase price", sheet.price], [`Down payment (${sheet.downPct}%)`, sheet.down],
        ["Lender fees (est.)", sheet.lenderFees], ["Title & recording (est.)", sheet.buyerTitle],
        ["Prepaids & escrow setup", sheet.prepaids], ["Earnest money credit", -sheet.earnest]];

      doc.setFontSize(10.5);
      rows.forEach(([label, val]) => {
        doc.setTextColor(70, 70, 80); doc.text(String(label), 40, y);
        doc.setTextColor(20, 20, 20); doc.text(fmtFull(val), W - 40, y, { align: "right" });
        y += 19;
      });

      y += 6; doc.setDrawColor(200, 200, 210); doc.line(40, y, W - 40, y); y += 22;
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text(side === "seller" ? "Estimated net to seller" : "Estimated cash to close", 40, y);
      doc.text(fmtFull(side === "seller" ? sheet.sellerNet : sheet.cashToClose), W - 40, y, { align: "right" });

      y += 34;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(140, 100, 20);
      const disclaimer = deal.simulated
        ? "SIMULATED DEAL - this sheet was generated from demo data and does not describe a real transaction. Estimate only: doc stamps, title, lender and escrow fees vary by county and provider. Not a settlement statement."
        : "Estimate only. Doc stamps, title, lender and escrow fees vary by county and provider. This is a planning tool, not a settlement statement - verify against the Closing Disclosure.";
      doc.text(doc.splitTextToSize(disclaimer, W - 80), 40, y);

      // ASCII hyphen only: an em-dash forces UTF-16 metadata encoding.
      doc.setProperties({ title: `SPARK OS - Net Sheet - ${addr}` });
      doc.save(`spark-net-sheet-${addr.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
      setToast("Net sheet PDF exported.");
    } catch (err) {
      setToast(`PDF export failed — ${err.message || "unknown error"}.`);
    } finally { setExporting(false); }
  }, [side]);

  // ── derived ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (stageFilter !== "all" && d.stage !== stageFilter) return false;
      if (!q) return true;
      const hay = `${d.name} ${d.detail?.address || ""} ${d.detail?.clientName || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deals, query, stageFilter]);

  const hud = useMemo(() => {
    const active = deals.filter((d) => d.stage !== "closed");
    const volume = active.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const critical = active.reduce((n, d) => {
      const det = d.detail || {};
      return n + CONTINGENCIES.filter((c) => {
        const h = hoursUntil(det[c.key], now);
        return h != null && h >= 0 && h <= URGENT_HOURS;
      }).length;
    }, 0);
    const probs = active.map((d) => Number(d.probability) || 50);
    const health = probs.length ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : 0;
    return { volume, gci: volume * GCI_RATE, critical, health, activeCount: active.length };
  }, [deals, now]);

  const sheet = useMemo(
    () => selected ? computeNetSheet(selected.value, selected.detail?.netSheet, selected.detail?.closeDate || selected.closeDate) : null,
    [selected],
  );

  const sortedRows = useMemo(() => {
    const rows = [...filtered];
    const { col, dir } = sort;
    rows.sort((a, b) => {
      const get = (d) => {
        if (col === "address") return (d.detail?.address || d.name || "").toLowerCase();
        if (col === "client") return (d.detail?.clientName || "").toLowerCase();
        if (col === "price") return Number(d.value) || 0;
        if (col === "stage") return STAGES.findIndex((s) => s.id === d.stage);
        if (col === "inspection") return new Date(d.detail?.inspectionDate || 8.64e15).getTime();
        if (col === "net") return computeNetSheet(d.value, d.detail?.netSheet, d.detail?.closeDate).sellerNet;
        return new Date(d.detail?.closeDate || d.closeDate || 8.64e15).getTime();
      };
      const av = get(a), bv = get(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, sort]);

  const anySim = deals.some((d) => d.simulated);

  if (booting) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", background: BG }}>
        <style>{TI_KEYFRAMES}</style>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Zap size={46} color={PURPLE_LT} fill={PURPLE_LT}
            style={{ filter: `drop-shadow(0 0 22px ${PURPLE})`, animation: "tiBootPulse 1.5s ease-in-out infinite" }} />
          <div className="font-mono tracking-wider text-slate-400" style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: 2.2, color: SLATE_DIM,
            textAlign: "center", padding: "0 24px", lineHeight: 1.7, maxWidth: 480,
          }}>
            DECRYPTING TRANSACTION INTELLIGENCE &amp; STAKEHOLDER MATRIX...
          </div>
        </div>
      </div>
    );
  }

  const pad = isMobile ? 24 : 32;

  return (
    <div ref={rootRef}
      className="w-full h-full flex flex-col bg-[#050505] text-white max-w-none"
      style={{
        position: "relative", width: "100%", maxWidth: "none", height: "100%", minHeight: 0,
        background: BG, color: "#fff", display: "flex", flexDirection: "column", boxSizing: "border-box",
      }}>
      <style>{TI_KEYFRAMES}</style>

      <div className="w-full p-6 md:p-8" style={{
        flex: 1, overflowY: "auto", minHeight: 0, width: "100%", padding: pad, boxSizing: "border-box",
        scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,.07) transparent",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ minWidth: 0, marginRight: "auto" }}>
            <div className="tracking-wider text-slate-400" style={{
              fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2.2,
              color: SLATE_DIM, textTransform: "uppercase", marginBottom: 4,
            }}>Transaction Intelligence &amp; Lifecycle Terminal</div>
            <div style={{ fontFamily: F, fontSize: 21, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
              <span className="font-mono" style={{ fontFamily: MONO, color: CYAN, textShadow: `0 0 20px ${CYAN}88` }}>
                {fmtMoney(hud.volume)}
              </span>{" "}
              ACROSS {hud.activeCount} ACTIVE DEAL{hud.activeCount !== 1 ? "S" : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 11, background: "rgba(0,0,0,0.5)", border: `1px solid ${HAIRLINE}` }}>
            {[{ id: "kanban", label: "Kanban Matrix", icon: LayoutGrid }, { id: "table", label: "Master Table", icon: Table2 }].map((v) => {
              const I = v.icon;
              return (
                <button key={v.id} onClick={() => setView(v.id)} className="font-mono" style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, cursor: "pointer",
                  fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                  background: view === v.id ? `${PURPLE}22` : "transparent",
                  border: `1px solid ${view === v.id ? `${PURPLE}88` : "transparent"}`,
                  color: view === v.id ? PURPLE_LT : SLATE_DIM,
                  boxShadow: view === v.id ? `0 0 12px ${PURPLE}44` : "none",
                }}>
                  <I size={11} /> [ {v.label} ]
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Telemetry HUD ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full" style={{
          display: "grid", width: "100%", gap: 16, marginBottom: 20,
          gridTemplateColumns: wide ? "repeat(4, minmax(0,1fr))" : mid ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)",
        }}>
          <HudCard label="Active Transaction Volume" value={hud.volume} color={CYAN} icon={Building2}
            sub={`${hud.activeCount} deal${hud.activeCount !== 1 ? "s" : ""} not yet closed`} />
          <HudCard label="Projected Agent GCI" value={hud.gci} color={GREEN} icon={TrendingUp}
            sub={`Live ${GCI_RATE * 100}% calculation on active volume`} />
          <HudCard label="Critical Contingency Risk" value={hud.critical} color={hud.critical > 0 ? RED : SLATE_HEX}
            format="int" pulse={hud.critical > 0} icon={AlertTriangle}
            sub={`Hard-stop dates inside ${URGENT_HOURS} hours`} />
          <HudCard label="Average Pipeline Health" value={hud.health} color={PURPLE_LT} format="pct" icon={LineChart}
            sub="Mean close probability across active deals" />
        </div>

        {/* ── Search + stage filter ── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, width: "100%" }}>
          <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 38,
            borderRadius: 10, background: "rgba(0,0,0,0.55)", border: `1px solid ${HAIRLINE}`,
            flex: "1 1 240px", minWidth: 0,
          }}>
            <Search size={13} color={SLATE_DIM} style={{ flexShrink: 0 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address, client…" className="ti-input"
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: MONO, fontSize: 11, color: "#fff" }} />
            {query && <button onClick={() => setQuery("")} style={{ background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={12} /></button>}
          </div>

          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${HAIRLINE}`, flexWrap: "wrap" }}>
            {[{ id: "all", label: "All", color: SLATE_HEX }, ...STAGES].map((s) => (
              <button key={s.id} onClick={() => setStageFilter(s.id)} className="font-mono" style={{
                padding: "6px 10px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase",
                background: stageFilter === s.id ? `${s.color}1e` : "transparent",
                border: `1px solid ${stageFilter === s.id ? `${s.color}88` : "transparent"}`,
                color: stageFilter === s.id ? s.color : SLATE_DIM,
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {anySim && (
          <div className="font-mono" style={{
            fontFamily: MONO, fontSize: 8, lineHeight: 1.6, color: AMBER, marginBottom: 16,
            background: `${AMBER}0d`, border: `1px solid ${AMBER}40`, borderRadius: 8, padding: "8px 11px",
          }}>
            ⚠ DEMO TRANSACTIONS ACTIVE — SIM-BADGED DEALS ARE SYNTHESIZED SO THE TERMINAL IS OPERATIONAL
            BEFORE YOUR PIPELINE IS FULL. THEY ARE NEVER WRITTEN TO YOUR RECORDS OR TRANSMITTED TO YOUR BROKERAGE.
          </div>
        )}

        {/* ── Board ── */}
        {view === "kanban" ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full" style={{
            display: "grid", width: "100%", gap: 14, alignItems: "start",
            gridTemplateColumns: wide ? "repeat(5, minmax(0,1fr))" : mid ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)",
          }}>
            {STAGES.map((st) => {
              const col = filtered.filter((d) => d.stage === st.id);
              const vol = col.reduce((s, d) => s + (Number(d.value) || 0), 0);
              return (
                <div key={st.id} style={{ minWidth: 0 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
                    paddingBottom: 8, borderBottom: `1px solid ${st.color}33`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, boxShadow: `0 0 7px ${st.color}`, flexShrink: 0 }} />
                    <span className="tracking-wider" style={{
                      fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.2,
                      color: st.color, textTransform: "uppercase", flex: 1, minWidth: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>[ {st.label} ]</span>
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, color: SLATE_DIM, flexShrink: 0 }}>{col.length}</span>
                  </div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, marginBottom: 9 }}>
                    {vol > 0 ? fmtMoney(vol) : "—"}
                  </div>
                  {col.map((d) => (
                    <DealCard key={d.id} deal={d} now={now} onOpen={setSelected} onClient={openClient} />
                  ))}
                  {col.length === 0 && (
                    <div className="font-mono" style={{
                      fontFamily: MONO, fontSize: 8.5, color: "rgba(148,163,184,0.35)", textAlign: "center",
                      padding: "18px 8px", border: `1px dashed ${HAIRLINE}`, borderRadius: 10,
                    }}>EMPTY</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full" style={{
            width: "100%", border: `1px solid ${HAIRLINE}`, borderRadius: 12, overflow: "hidden",
            background: "rgba(0,0,0,0.5)",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.035)" }}>
                    {[["address", "Address"], ["client", "Client"], ["price", "Price"], ["stage", "Stage"],
                    ["inspection", "Inspection Deadline"], ["closeDate", "Closing"], ["net", "Net Proceeds"]].map(([col, label]) => (
                      <th key={col} onClick={() => setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))}
                        className="tracking-wider" style={{
                          textAlign: col === "price" || col === "net" ? "right" : "left",
                          padding: "10px 14px", cursor: "pointer", userSelect: "none",
                          fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.2,
                          color: sort.col === col ? CYAN : SLATE_DIM, textTransform: "uppercase",
                          borderBottom: `1px solid ${HAIRLINE}`, whiteSpace: "nowrap",
                        }}>
                        {label}
                        {sort.col === col
                          ? (sort.dir === "asc" ? <ChevronUp size={9} style={{ verticalAlign: -1, marginLeft: 4 }} /> : <ChevronDown size={9} style={{ verticalAlign: -1, marginLeft: 4 }} />)
                          : <ArrowUpDown size={8} style={{ verticalAlign: -1, marginLeft: 4, opacity: 0.4 }} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((d) => {
                    const st = STAGE_BY_ID[d.stage];
                    const health = dealHealth(d, now);
                    const ns = computeNetSheet(d.value, d.detail?.netSheet, d.detail?.closeDate || d.closeDate);
                    const insH = hoursUntil(d.detail?.inspectionDate, now);
                    return (
                      <tr key={d.id} onClick={() => setSelected(d)} className="ti-row" style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "11px 14px", fontFamily: F, fontSize: 11.5, color: "#fff", maxWidth: 260 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: health.color, boxShadow: `0 0 6px ${health.color}`, flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.detail?.address || d.name}</span>
                            {d.simulated && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 6.5, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>SIM</span>}
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          {d.detail?.clientName ? (
                            <button onClick={(e) => { e.stopPropagation(); openClient(d.detail.clientName); }}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 4, background: `${CYAN}14`,
                                border: `1px solid ${CYAN}55`, borderRadius: 999, padding: "3px 9px", cursor: "pointer",
                                color: CYAN, fontFamily: F, fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap",
                              }}><Link2 size={8} />{d.detail.clientName}</button>
                          ) : <span style={{ color: SLATE_DIM, fontFamily: F, fontSize: 10.5 }}>—</span>}
                        </td>
                        <td className="font-mono" style={{ padding: "11px 14px", textAlign: "right", fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{fmtMoney(d.value)}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <span className="font-mono" style={{
                            fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 0.7, color: st.color,
                            background: `${st.color}16`, border: `1px solid ${st.color}55`, borderRadius: 999,
                            padding: "3px 8px", whiteSpace: "nowrap", textTransform: "uppercase",
                          }}>{st.label}</span>
                        </td>
                        <td className="font-mono" style={{
                          padding: "11px 14px", fontFamily: MONO, fontSize: 10.5, whiteSpace: "nowrap",
                          color: insH != null && insH >= 0 && insH <= URGENT_HOURS ? RED : SLATE,
                        }}>{fmtDate(d.detail?.inspectionDate)}</td>
                        <td className="font-mono" style={{ padding: "11px 14px", fontFamily: MONO, fontSize: 10.5, color: SLATE, whiteSpace: "nowrap" }}>{fmtDate(d.detail?.closeDate || d.closeDate)}</td>
                        <td className="font-mono" style={{ padding: "11px 14px", textAlign: "right", fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ns.sellerNet >= 0 ? GREEN : RED, whiteSpace: "nowrap" }}>{fmtFull(ns.sellerNet)}</td>
                      </tr>
                    );
                  })}
                  {sortedRows.length === 0 && (
                    <tr><td colSpan={7} className="font-mono" style={{ padding: 28, textAlign: "center", fontFamily: MONO, fontSize: 10, color: SLATE_DIM }}>
                      NO DEALS MATCH THIS FILTER.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Dossier drawer ── */}
      {selected && sheet && (
        <>
          <div onClick={() => setSelected(null)} style={{
            position: "absolute", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
          }} />
          {/* A mount keyframe, not a framer-motion entrance and not a
              state-driven transition. The motion entrance stalled mid-slide
              (measured stuck at translateX(183px) of 468px) and a
              rAF-toggled transition failed to flip at all under StrictMode's
              double-invoked effects — both left the dossier off-screen. A
              keyframe with `both` fill needs no state and cannot miss. */}
          <div
            className="backdrop-blur-2xl bg-black/60 border-l border-white/10"
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0, zIndex: 130,
              width: "min(468px, 100%)", overflowY: "auto",
              animation: "tiSlideIn .28s cubic-bezier(.16,1,.3,1) both",
              background: "rgba(6,6,10,0.96)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
              borderLeft: `1px solid ${HAIRLINE}`, padding: 20, boxSizing: "border-box",
            }}>
            <DealDossier
              deal={selected} sheet={sheet} side={side} onSide={setSide} now={now}
              dispatched={dispatched} onDispatch={(label, date) => dispatchAlert(selected, label, date)}
              onClose={() => setSelected(null)} onClient={openClient}
              onStage={(s) => changeStage(selected, s)}
              onPatchDetail={(p) => persistDetail(selected.id, p)}
              onExport={() => exportNetSheet(selected, sheet)} exporting={exporting}
              onBridge={(tool) => bridgeTo(tool, selected)}
              syncNote={syncNote}
            />
          </div>
        </>
      )}

      {toast && (
        <div className="backdrop-blur-2xl" style={{
          position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 200,
          background: "rgba(6,6,12,0.95)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${CYAN}88`, borderRadius: 10, padding: "10px 18px", color: "#fff",
          fontFamily: F, fontSize: 11.5, fontWeight: 700, boxShadow: `0 0 24px ${CYAN}55`,
          maxWidth: "86%", textAlign: "center",
        }}>{toast}</div>
      )}
    </div>
  );
}

// ── dossier body ──────────────────────────────────────────────────────────
function DealDossier({
  deal, sheet, side, onSide, now, dispatched, onDispatch, onClose, onClient,
  onStage, onPatchDetail, onExport, exporting, onBridge, syncNote,
}) {
  const d = deal.detail || {};
  const health = dealHealth(deal, now);
  const st = STAGE_BY_ID[deal.stage];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: health.color, boxShadow: `0 0 8px ${health.color}`, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tracking-wider text-slate-400" style={{
            fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase",
          }}>Active Deal Dossier</div>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginTop: 3 }}>
            {d.address || deal.name}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0, flexShrink: 0 }}><X size={17} /></button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", margin: "10px 0 16px" }}>
        <span className="font-mono" style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 800, color: st.color, background: `${st.color}16`,
          border: `1px solid ${st.color}55`, borderRadius: 999, padding: "3px 9px", textTransform: "uppercase",
        }}>{st.label}</span>
        {deal.simulated
          ? <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "2px 5px" }}>SIM</span>
          : <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: CYAN, border: `1px solid ${CYAN}55`, borderRadius: 4, padding: "2px 5px" }}>LIVE</span>}
        {d.clientName && (
          <button onClick={() => onClient(d.clientName)} style={{
            display: "inline-flex", alignItems: "center", gap: 4, background: `${CYAN}14`,
            border: `1px solid ${CYAN}55`, borderRadius: 999, padding: "3px 9px", cursor: "pointer",
            color: CYAN, fontFamily: F, fontSize: 9.5, fontWeight: 700,
          }}><Link2 size={8} />{d.clientName}</button>
        )}
        <span className="font-mono" style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 15, fontWeight: 800, color: "#fff" }}>
          {fmtMoney(deal.value)}
        </span>
      </div>

      {/* stage advance */}
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${HAIRLINE}`, marginBottom: 8, flexWrap: "wrap" }}>
        {STAGES.map((s) => (
          <button key={s.id} onClick={() => onStage(s.id)} className="font-mono" title={`Move to ${s.label}`} style={{
            flex: "1 1 auto", padding: "6px 4px", borderRadius: 6, cursor: "pointer",
            fontFamily: MONO, fontSize: 7, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
            background: deal.stage === s.id ? `${s.color}22` : "transparent",
            border: `1px solid ${deal.stage === s.id ? `${s.color}88` : "transparent"}`,
            color: deal.stage === s.id ? s.color : SLATE_DIM, whiteSpace: "nowrap",
          }}>{s.label.split(" ")[0]}</button>
        ))}
      </div>
      {syncNote && (
        <div className="font-mono" style={{
          fontFamily: MONO, fontSize: 8, lineHeight: 1.6, color: /not transmitted|Simulated/.test(syncNote) ? AMBER : GREEN,
          background: `${/not transmitted|Simulated/.test(syncNote) ? AMBER : GREEN}0d`,
          border: `1px solid ${/not transmitted|Simulated/.test(syncNote) ? AMBER : GREEN}44`,
          borderRadius: 8, padding: "7px 10px", marginBottom: 16,
        }}>{syncNote}</div>
      )}

      {/* ── A · contingency timers ── */}
      <Section label="A · Hard-Stop Contingency Timers" color={RED}>
        {CONTINGENCIES.map((c) => (
          <ContingencyBar key={c.key} label={c.label} date={d[c.key]} offerDate={d.offerDate}
            now={now} dispatched={dispatched.includes(`${deal.id}:${c.label}`)}
            onDispatch={(label, date) => onDispatch(label, date)} />
        ))}
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, lineHeight: 1.6 }}>
          DATES UNDER {CRITICAL_HOURS}H DISPATCH TO YOUR AUTOPILOT HUD ON DEMAND.
        </div>
      </Section>

      {/* ── B · stakeholders ── */}
      <Section label="B · Stakeholder Command Dock" color={CYAN}>
        <StakeholderDock stakeholders={d.stakeholders} now={now} />
      </Section>

      {/* ── C · document intake ── */}
      <Section label="C · Document Intelligence" color={PURPLE}>
        <DossierDropzone onExtracted={onPatchDetail} />
      </Section>

      {/* ── D · net sheet ── */}
      <Section label="D · Net Sheet & Cash-to-Close" color={GREEN}>
        <NetSheet deal={deal} sheet={sheet} side={side} onSide={onSide} onExport={onExport} exporting={exporting} />
      </Section>

      {/* ── E · collateral bridge ── */}
      <Section label="E · Collateral Bridge" color={PURPLE_LT} last>
        <div style={{ display: "grid", gap: 9 }}>
          <button onClick={() => onBridge("presentation")} style={bridgeBtn(PURPLE)}>
            <Presentation size={12} /> [ Generate Presentation Deck ]
          </button>
          <button onClick={() => onBridge("cma")} style={bridgeBtn(CYAN)}>
            <LineChart size={12} /> [ Run Pricing CMA ]
          </button>
        </div>
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, lineHeight: 1.6, marginTop: 9 }}>
          OPENS THE TOOL WITH THIS PROPERTY&apos;S ADDRESS AND PRICE PRE-LOADED.
        </div>
      </Section>
    </>
  );
}

function bridgeBtn(color) {
  return {
    width: "100%", padding: "12px 14px", borderRadius: 10, cursor: "pointer",
    background: `${color}1c`, border: `1px solid ${color}88`, color,
    fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  };
}

function Section({ label, color, children, last }) {
  return (
    <div style={{ marginBottom: last ? 8 : 20 }}>
      <div className="tracking-wider" style={{
        fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.8, color,
        textTransform: "uppercase", marginBottom: 10, paddingBottom: 7,
        borderBottom: `1px solid ${color}2e`,
      }}>{label}</div>
      {children}
    </div>
  );
}

// ── document intake ───────────────────────────────────────────────────────
// Reuses the /api/claude vision proxy the rest of the app already uses. Images
// only — the same limit the existing Transaction Timeline dropzone has; a PDF
// would need rasterizing first, and silently accepting one then failing is
// worse than refusing it clearly.
const EXTRACT_FIELDS = [
  ["address", "full property address"],
  ["clientName", "buyer or seller name"],
  ["salePrice", "sale/purchase price as digits only"],
  ["offerDate", "contract/offer acceptance date as YYYY-MM-DD"],
  ["closeDate", "closing date as YYYY-MM-DD"],
  ["inspectionDate", "inspection deadline as YYYY-MM-DD"],
  ["appraisalDate", "appraisal deadline as YYYY-MM-DD"],
  ["loanCommitmentDate", "loan commitment/financing deadline as YYYY-MM-DD"],
];

function DossierDropzone({ onExtracted }) {
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState("idle");
  const [err, setErr] = useState("");
  const [found, setFound] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setErr("Images only — a screenshot or photo of the contract page. PDFs aren't parsed yet.");
      return;
    }
    setStatus("reading"); setErr(""); setFound(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const prompt = `Extract these fields from this real estate contract image. Return ONLY compact JSON with these keys, using null for anything not clearly visible. Do not guess.\n${EXTRACT_FIELDS.map(([k, desc]) => `"${k}": ${desc}`).join("\n")}`;
      const r = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
              { type: "text", text: prompt },
            ],
          }],
          max_tokens: 900,
        }),
      });
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Document parsing needs the deployed API — it isn't available here.");
      const j = await r.json();
      if (!r.ok || j?.error) throw new Error(j?.error?.message || j?.error || `HTTP ${r.status}`);
      const raw = j.content?.[0]?.text || "";
      const first = raw.indexOf("{"), last = raw.lastIndexOf("}");
      const parsed = JSON.parse(first !== -1 && last > first ? raw.slice(first, last + 1) : raw);
      const clean = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v != null && v !== ""));
      if (!Object.keys(clean).length) throw new Error("Nothing readable was found in that image.");
      setFound(clean); setStatus("done");
    } catch (e) {
      setStatus("error");
      setErr(e.message || "Could not read that document.");
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1px dashed ${drag ? PURPLE : HAIRLINE}`, borderRadius: 11, padding: "20px 14px",
          textAlign: "center", cursor: "pointer", background: drag ? `${PURPLE}0e` : "rgba(255,255,255,0.02)",
          transition: "border-color .16s ease, background .16s ease",
        }}>
        <input ref={inputRef} type="file" accept="image/*" hidden
          onChange={(e) => handleFile(e.target.files?.[0])} />
        {status === "reading"
          ? <Loader2 size={19} color={PURPLE_LT} style={{ animation: "tiSpin 1s linear infinite" }} />
          : <Upload size={19} color={drag ? PURPLE_LT : SLATE_DIM} />}
        <div style={{ fontFamily: F, fontSize: 11, color: SLATE, marginTop: 8, fontWeight: 600 }}>
          {status === "reading" ? "Reading contract…" : "Drop a contract screenshot"}
        </div>
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, marginTop: 4 }}>
          PARSES PRICE, DATES &amp; BUYER NAME · IMAGES ONLY
        </div>
      </div>

      {status === "error" && (
        <div className="font-mono" style={{
          fontFamily: MONO, fontSize: 9, color: AMBER, marginTop: 9, lineHeight: 1.6,
          background: `${AMBER}0d`, border: `1px solid ${AMBER}44`, borderRadius: 8, padding: "8px 10px",
        }}>{err}</div>
      )}

      {status === "done" && found && (
        <div style={{ marginTop: 11, border: `1px solid ${PURPLE}44`, borderRadius: 10, padding: 12, background: `${PURPLE}08` }}>
          <div className="tracking-wider" style={{
            fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.3, color: PURPLE_LT,
            textTransform: "uppercase", marginBottom: 8,
          }}>Extracted · review before applying</div>
          {Object.entries(found).map(([k, v]) => (
            <div key={k} className="font-mono" style={{
              display: "flex", gap: 9, padding: "4px 0", fontFamily: MONO, fontSize: 9.5,
            }}>
              <span style={{ color: SLATE_DIM, minWidth: 122 }}>{k}</span>
              <span style={{ color: "#fff", flex: 1, minWidth: 0, wordBreak: "break-word" }}>{String(v)}</span>
            </div>
          ))}
          <button onClick={() => { onExtracted(found); setStatus("idle"); setFound(null); }}
            style={{
              width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 9, cursor: "pointer",
              background: `linear-gradient(135deg,#7c3aed,${PURPLE})`, border: `1px solid ${PURPLE}`,
              color: "#fff", fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1,
              textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}>
            <CheckCircle2 size={12} /> Apply to this deal
          </button>
        </div>
      )}
    </div>
  );
}

const TI_KEYFRAMES = `
@keyframes tiPulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(2.6);opacity:0}}
@keyframes tiSpin{to{transform:rotate(360deg)}}
@keyframes tiBlink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes tiBootPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.9)}}
@keyframes tiPulseBorder{0%,100%{border-color:${RED}55;box-shadow:0 0 0 rgba(255,59,92,0)}50%{border-color:${RED};box-shadow:0 0 18px rgba(255,59,92,.35)}}
@keyframes tiSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes tiGlowRed{0%,100%{box-shadow:0 0 8px ${RED}44}50%{box-shadow:0 0 20px ${RED}88}}
.ti-input::placeholder{color:rgba(148,163,184,0.45)}
.ti-row:hover{background:rgba(255,255,255,0.03)}
`;
