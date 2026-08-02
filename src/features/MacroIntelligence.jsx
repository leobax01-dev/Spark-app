// src/features/MacroIntelligence.jsx — SPARK OS Macro-Intelligence &
// Autonomous Inbound Terminal.
//
// Replaces the Market page's manual "Lead Details" form. An agent should not
// be typing a lead into a box that already arrived in their system — the
// queue reads real capture-page submissions and the form is gone.
//
// Standing adaptations, same rationale as every other SPARK OS terminal:
//
// 1. Styling: no Tailwind is configured — requested className strings are kept
//    and backed by inline styles. Breakpoints measure the CONTAINER, since
//    this panel renders beside a ~250px sidebar.
//
// 2. Animation: recharts series ALL carry isAnimationActive={false} (the
//    animation lifecycle does not resolve here and series render empty), the
//    drawer slide is a mount keyframe, and framer-motion is used only for
//    imperative value tickers. Nothing is gated behind an animation.
//
// 3. Provenance. Inbound leads are real when they came from the capture page
//    (api/google-data.js capture_lead writes them into the client store).
//    The macro price/inventory series and the micro-farm counts are
//    SYNTHESIZED — this app has no historical price index and no sold/pending
//    feed — so they are badged SIM and absorption rate refuses to show a
//    months-of-supply number it cannot compute.
//
// 4. Bridges write only on explicit click, and never for SIM rows.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import {
  Zap, X, Search, Inbox, BarChart3, MapPinned, Loader2, CheckCircle2,
  ArrowUpDown, ChevronUp, ChevronDown, Radio, Target, TrendingUp, Wallet,
  Copy, Check, Send, Trash2, Link2, Radar, Clock, AlertTriangle, FileText,
} from "lucide-react";
import { lsGet, lsSet, cloudSync } from "../utils/storage";
import { useContainerWidth, breakpoints, kpiRail, figureSize, headingSize, chartHeight, axisProps, gridProps, legendProps } from "../responsive";
import {
  enrichLead, leadsFromClients, macroTelemetry, absorption,
  synthesizeLeads, synthesizeFarms, synthesizeMacroSeries, parseMoney, agoLabel,
} from "./macro";

const BG = "#050505";
const CYAN = "#38bdf8";
const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";
const SLATE_HEX = "#94a3b8";
const HAIRLINE = "#27272a";
const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CLIENTS_KEY = "spark_clients_v1";
const GOALS_KEY = "spark_biz_goals_v1";
const DEALS_KEY = "spark_pipeline_value_v1";
const FARMS_KEY = "spark_micro_farms_v1";
const DISCARDED_KEY = "spark_inbound_discarded_v1";

function fmtMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}
function fmtFull(n) { return `$${Math.round(Number(n) || 0).toLocaleString()}`; }


function useTicker(target, duration = 1.0) {
  const [shown, setShown] = useState(Number(target) || 0);
  const prev = useRef(Number(target) || 0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(target) || 0;
    prev.current = to;
    if (from === to) { setShown(to); return; }
    const c = animate(from, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setShown, onComplete: () => setShown(to) });
    return () => c.stop();
  }, [target, duration]);
  return shown;
}

// ── HUD ───────────────────────────────────────────────────────────────────
function HudCard({ bp, cardStyle, label, value, sub, color, icon: I, format = "int", bar, pulse, unavailable }) {
  const shown = useTicker(unavailable ? 0 : value);
  const text = unavailable ? "—"
    : format === "money" ? fmtMoney(shown)
      : format === "pct" ? `${shown.toFixed(1)}%`
        : format === "months" ? `${shown.toFixed(1)} mo`
          : `${Math.round(shown)}`;
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      minWidth: 0, padding: 15, borderRadius: 13, ...cardStyle,
      background: `#111111`,
      backdropFilter: "none", WebkitBackdropFilter: "none",
      border: `1px solid ${color}33`,
      animation: pulse ? "miPulseBorder 1.8s ease-in-out infinite" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        {I && <I size={11} color={color} />}
        <span className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.5, color: SLATE_DIM,
          textTransform: "uppercase", lineHeight: 1.35,
        }}>[ {label} ]</span>
      </div>
      <div className="font-mono" style={{
        fontFamily: MONO, fontSize: figureSize(bp || {}), fontWeight: 800, color: unavailable ? SLATE_DIM : color,
        lineHeight: 1.1, whiteSpace: "nowrap",
      }}>{text}</div>
      {bar != null && (
        <div style={{ height: 5, borderRadius: 3, background: "#27272a", overflow: "hidden", marginTop: 8 }}>
          <div style={{ width: `${Math.max(0, Math.min(100, bar))}%`, height: "100%", background: color, boxShadow: "none", transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
        </div>
      )}
      <div style={{ fontFamily: F, fontSize: 9.5, color: SLATE_DIM, marginTop: "auto", paddingTop: 6, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

function IntentBar({ value }) {
  const color = value >= 75 ? GREEN : value >= 50 ? CYAN : value >= 30 ? SLATE_HEX : SLATE_DIM;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 44, height: 5, borderRadius: 3, background: "#27272a", overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, boxShadow: "none", transition: "width .5s cubic-bezier(.16,1,.3,1)" }} />
      </div>
      <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color, minWidth: 26, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── sequence engine ───────────────────────────────────────────────────────
// Generated locally and deterministically. A network round-trip here would add
// a failure mode to the one thing an agent needs within five minutes.
function buildSequence(lead) {
  const first = (lead.name || "there").split(" ")[0];
  const prop = lead.propertyAddress || "the property you asked about";
  const priced = lead.propertyPrice ? ` (${lead.propertyPrice})` : "";
  const asked = /when can i|can i see|showing|tour|available/i.test(lead.message || "");
  return {
    text: `Hi ${first} — this is your agent following up on ${prop}${priced}. ${asked ? "Yes, it's available — I can get you in today or tomorrow." : "Happy to send over the details and recent comps."} What time works?`,
    email: {
      subject: `${prop} — details and next steps`,
      body: `Hi ${first},

Thanks for reaching out about ${prop}${priced}.

${asked
          ? "It's still available, and I can arrange a showing today or tomorrow — just tell me a window that works and I'll confirm access."
          : "I've pulled the full details plus the three most recent comparable sales on the block so you can see how it's priced."}

A couple of quick questions so I don't waste your time:
· Are you working with a lender yet, or would a referral help?
· Is this the only property on your list, or should I set up a search?

I'll follow up by phone shortly either way.`,
    },
  };
}

function buildMarketUpdate(series, farms, telemetry) {
  const latest = series[series.length - 1];
  const first = series[0];
  const psfChange = ((latest.medianPsf - first.medianPsf) / first.medianPsf) * 100;
  const invChange = ((latest.inventory - first.inventory) / first.inventory) * 100;
  const hottest = [...farms].sort((a, b) => b.momPct - a.momPct)[0];
  const line = "─".repeat(56);

  return `SPARK OS — SPHERE MARKET UPDATE
${line}
GENERATED  ${new Date().toLocaleString()}

── 30-SECOND VIDEO SCRIPT ──

"Quick market update for you.

Median price per square foot in our market is at $${latest.medianPsf} — that's ${psfChange >= 0 ? "up" : "down"} ${Math.abs(psfChange).toFixed(1)}% over the last twelve months.

Inventory is ${invChange >= 0 ? "up" : "down"} ${Math.abs(invChange).toFixed(1)}%, sitting around ${latest.inventory.toLocaleString()} active listings, and the 30-year is hovering near ${latest.rate}%.

${hottest ? `The area moving fastest right now is ${hottest.name} — ${hottest.momPct >= 0 ? "up" : "down"} ${Math.abs(hottest.momPct).toFixed(1)}% month over month with ${hottest.pending} properties already under contract.` : ""}

If you've been waiting for a signal, this is the part where it's worth a ten-minute conversation. Reply to this and I'll send you what your specific place is worth today."

── EMAIL BLAST ──

SUBJECT: What your home is actually worth right now

Hi [First name],

Rather than send you another generic market report, here are the three numbers that actually matter this month:

· Median $/sqft: $${latest.medianPsf} (${psfChange >= 0 ? "+" : ""}${psfChange.toFixed(1)}% YoY)
· Active inventory: ${latest.inventory.toLocaleString()} (${invChange >= 0 ? "+" : ""}${invChange.toFixed(1)}% YoY)
· 30-year rate: ${latest.rate}%

${hottest ? `Fastest-moving area: ${hottest.name}, ${hottest.pending} under contract against ${hottest.active} active.` : ""}

What this means for you depends entirely on your street, not the city average. Reply with your address and I'll send back a specific number — no obligation, no listing pitch.

${line}
NOTE: The macro series and micro-farm figures in this draft are SIMULATED
demo data. This app has no historical price index or sold-listing feed wired
up. Verify every number against your MLS before sending this to a client.`;
}

// ── lead dossier ──────────────────────────────────────────────────────────
function Section({ label, color, children, last }) {
  return (
    <div style={{ marginBottom: last ? 8 : 20 }}>
      <div className="tracking-wider" style={{
        fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.8, color,
        textTransform: "uppercase", marginBottom: 10, paddingBottom: 7, borderBottom: `1px solid ${color}2e`,
      }}>{label}</div>
      {children}
    </div>
  );
}

function CopyBlock({ label, text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard blocked — the text stays selectable on screen */ }
  };
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span className="tracking-wider" style={{ flex: 1, fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase" }}>{label}</span>
        <button onClick={copy} style={{
          display: "flex", alignItems: "center", gap: 4, background: "transparent",
          border: `1px solid ${copied ? GREEN : HAIRLINE}`, borderRadius: 6, padding: "3px 8px",
          color: copied ? GREEN : SLATE_DIM, cursor: "pointer", fontFamily: MONO, fontSize: 7.5,
          textTransform: "uppercase", letterSpacing: 1,
        }}>
          {copied ? <Check size={9} /> : <Copy size={9} />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="font-mono" style={{
        margin: 0, background: "#111111", border: `1px solid ${HAIRLINE}`, borderRadius: 9,
        padding: 11, fontFamily: MONO, fontSize: 10, lineHeight: 1.65, color: SLATE,
        whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflowY: "auto",
      }}>{text}</pre>
    </div>
  );
}

function LeadDossier({ lead, onClose, onBridge, busy }) {
  const seq = useMemo(() => buildSequence(lead), [lead]);
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: lead.fresh ? GREEN : CYAN, boxShadow: "none", flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tracking-wider text-slate-400" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
            Inbound Telemetry Dossier
          </div>
          <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginTop: 3 }}>{lead.name}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0, flexShrink: 0 }}><X size={17} /></button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
        <span className="font-mono" style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 800, color: CYAN, background: `${CYAN}16`,
          border: `1px solid ${CYAN}55`, borderRadius: 999, padding: "3px 9px", textTransform: "uppercase",
        }}>{lead.sourceLabel}</span>
        {lead.simulated
          ? <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "2px 5px" }}>SIM</span>
          : <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: GREEN, border: `1px solid ${GREEN}55`, borderRadius: 4, padding: "2px 5px" }}>LIVE</span>}
        {lead.fresh && (
          <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: GREEN, border: `1px solid ${GREEN}88`, borderRadius: 4, padding: "2px 5px", animation: "miBlink 1.2s ease-in-out infinite" }}>
            UNDER 5 MIN
          </span>
        )}
        <span className="font-mono" style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: SLATE_DIM }}>
          <Clock size={9} style={{ verticalAlign: -1, marginRight: 4 }} />{lead.ago} ago
        </span>
      </div>

      {/* A — vitals */}
      <Section label="A · Lead & Property Vitals" color={CYAN}>
        <div style={{ display: "grid", gap: 8 }}>
          {[["Phone", lead.phone], ["Email", lead.email], ["Target property", lead.propertyAddress], ["Stated price", lead.propertyPrice]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.1, color: SLATE_DIM, textTransform: "uppercase", minWidth: 108, flexShrink: 0, paddingTop: 2 }}>{l}</span>
              <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: v ? "#fff" : SLATE_DIM, flex: 1, minWidth: 0, wordBreak: "break-word" }}>{v || "not provided"}</span>
            </div>
          ))}
        </div>
        {lead.message && (
          <div style={{ marginTop: 11, padding: 11, borderRadius: 9, border: `1px solid ${HAIRLINE}`, background: "#18181b" }}>
            <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 5 }}>Their words</div>
            <div style={{ fontFamily: F, fontSize: 11.5, color: SLATE, lineHeight: 1.6, fontStyle: "italic" }}>“{lead.message}”</div>
          </div>
        )}
      </Section>

      {/* B — intent */}
      <Section label="B · AI Intent Analysis" color={PURPLE}>
        <div style={{ border: `1px solid ${PURPLE}44`, borderRadius: 11, padding: 13, background: `${PURPLE}0a` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <span className="tracking-wider" style={{ flex: 1, fontFamily: MONO, fontSize: 8, letterSpacing: 1.3, color: SLATE_DIM, textTransform: "uppercase" }}>Intent score</span>
            <span className="font-mono" style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: PURPLE_LT, textShadow: "none"}}>{lead.intent}</span>
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            {lead.intentFactors.map((f, i) => (
              <div key={i} className="font-mono" style={{ display: "flex", gap: 8, fontFamily: MONO, fontSize: 9 }}>
                <span style={{ flex: 1, minWidth: 0, color: SLATE_DIM }}>{f.label}</span>
                <span style={{ color: f.delta >= 0 ? GREEN : RED, fontWeight: 700, flexShrink: 0 }}>{f.delta >= 0 ? "+" : ""}{f.delta}</span>
              </div>
            ))}
          </div>
          <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: AMBER, marginTop: 9, lineHeight: 1.6 }}>
            ⚠ MODELED FROM THE SUBMISSION ITSELF — A TRIAGE AID, NOT A PREDICTION.
          </div>
        </div>
      </Section>

      {/* C — sequence */}
      <Section label="C · The Sequence Engine" color={GREEN}>
        <CopyBlock label="Text 1 · send now" text={seq.text} />
        <CopyBlock label={`Email 1 · ${seq.email.subject}`} text={seq.email.body} />
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: SLATE_DIM, lineHeight: 1.6 }}>
          DRAFTED LOCALLY FROM THIS SUBMISSION · NOTHING IS SENT ON YOUR BEHALF.
        </div>
      </Section>

      {/* D — ecosystem bridge */}
      <Section label="D · The Ecosystem Bridge" color={PURPLE_LT} last>
        <div style={{ display: "grid", gap: 9 }}>
          <button onClick={() => onBridge("promote", lead)} disabled={busy}
            style={bridgeBtn(GREEN, busy)}>
            <Link2 size={12} /> [ Promote to Sphere Ledger ]
          </button>
          <button onClick={() => onBridge("scan", lead)} disabled={busy || !lead.propertyAddress}
            title={lead.propertyAddress ? undefined : "No target property on this lead to scan"}
            style={bridgeBtn(CYAN, busy || !lead.propertyAddress)}>
            <Radar size={12} /> [ Initiate Surveillance Scan ]
          </button>
          <button onClick={() => onBridge("discard", lead)} disabled={busy}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, cursor: busy ? "default" : "pointer",
              background: "transparent", border: `1px solid ${HAIRLINE}`, color: SLATE_DIM,
              fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            <Trash2 size={12} /> [ Discard ]
          </button>
        </div>
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: SLATE_DIM, lineHeight: 1.6, marginTop: 9 }}>
          PROMOTE MOVES THIS LEAD INTO YOUR CLIENT LEDGER AND OPENS THE SPHERE TERMINAL.
        </div>
      </Section>
    </>
  );
}

function bridgeBtn(color, disabled) {
  return {
    width: "100%", padding: "12px 14px", borderRadius: 10, cursor: disabled ? "default" : "pointer",
    background: `${color}1c`, border: `1px solid ${color}88`, color,
    fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    opacity: disabled ? 0.45 : 1,
  };
}

// ── main ──────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: "queue", label: "Inbound Queue", icon: Inbox, color: GREEN },
  { id: "macro", label: "Macro Matrix", icon: BarChart3, color: CYAN },
  { id: "farms", label: "Micro-Farms", icon: MapPinned, color: PURPLE },
];

export default function MacroIntelligence({ user, isMobile, onNavigate, onOpenTool }) {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("queue");
  const [leads, setLeads] = useState([]);
  const [farms, setFarms] = useState([]);
  const [goals, setGoals] = useState({});
  const [deals, setDeals] = useState([]);
  const [series] = useState(() => synthesizeMacroSeries());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ col: "intent", dir: "desc" });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [update, setUpdate] = useState(null);
  const [updating, setUpdating] = useState(false);

  const rootRef = useRef(null);
  const cw = useContainerWidth(rootRef);
  const wide = cw === 0 || cw >= 780;
  const bp = breakpoints(cw);
  const mid = cw === 0 || cw >= 560;

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const load = useCallback(() => {
    const clients = lsGet(CLIENTS_KEY, []) || [];
    const discarded = new Set(lsGet(DISCARDED_KEY, []) || []);
    const real = leadsFromClients(clients).filter((l) => !discarded.has(l.id));
    // Sparse means fewer than 2 real inbound leads — below that the queue
    // reads empty and there is nothing to demonstrate.
    const list = real.length >= 2 ? real : [...real, ...synthesizeLeads().filter((l) => !discarded.has(l.id))];
    setLeads(list);

    const storedFarms = lsGet(FARMS_KEY, []) || [];
    setFarms(storedFarms.length ? storedFarms : synthesizeFarms());
    setGoals(lsGet(GOALS_KEY, {}) || {});
    setDeals(lsGet(DEALS_KEY, []) || []);
    setBooting(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── bridges ─────────────────────────────────────────────────────────────
  const bridge = useCallback(async (kind, lead) => {
    if (kind === "discard") {
      const d = lsGet(DISCARDED_KEY, []) || [];
      lsSet(DISCARDED_KEY, [...d, lead.id]);
      setSelected(null);
      setLeads((ls) => ls.filter((l) => l.id !== lead.id));
      setToast(`${lead.name} removed from the inbound queue.`);
      return;
    }
    if (lead.simulated) {
      setToast("Demo lead — bridges are disabled so nothing synthesized reaches your real records.");
      return;
    }
    setBusy(true);
    try {
      if (kind === "promote") {
        const clients = lsGet(CLIENTS_KEY, []) || [];
        const next = clients.map((c) => c.id === lead._clientId
          ? { ...c, stage: c.stage === "prospect" ? "active" : c.stage, nextAction: "Promoted from inbound queue — begin sequence", updatedAt: new Date().toISOString() }
          : c);
        lsSet(CLIENTS_KEY, next);
        const synced = user?.email ? await cloudSync(user.email, { clients: next }) : false;
        setToast(`${lead.name} promoted to your sphere ledger.${synced ? "" : " Saved on this device — cloud sync did not confirm."}`);
        setSelected(null);
        load();
        setTimeout(() => onNavigate?.("clients"), 700);
      } else if (kind === "scan") {
        try { localStorage.setItem("spark_radar_focus_address", lead.propertyAddress); } catch { /* storage unavailable */ }
        setToast("Opening the acquisition grid on this property…");
        setTimeout(() => onNavigate?.("acqgrid"), 600);
      }
    } catch (e) {
      setToast(`Bridge failed — ${e.message || "unknown error"}.`);
    } finally { setBusy(false); }
  }, [user, onNavigate, load]);

  const genUpdate = useCallback(() => {
    setUpdating(true);
    // Deliberately paced so the readout is legible; the work itself is local.
    setTimeout(() => {
      setUpdate(buildMarketUpdate(series, farms, null));
      setUpdating(false);
    }, 900);
  }, [series, farms]);

  // ── derived ─────────────────────────────────────────────────────────────
  const hud = useMemo(() => macroTelemetry({ leads, goals, deals, farms }), [leads, goals, deals, farms]);
  // No sold/pending feed exists, so this always returns unavailable+modeled.
  // Kept as a real call rather than a hardcoded string so it starts working
  // the moment a sales-pace source is wired in.
  const abs = useMemo(() => absorption({ active: null, monthlySales: null }), []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = leads.filter((l) => !q || `${l.name} ${l.propertyAddress} ${l.sourceLabel}`.toLowerCase().includes(q));
    const get = (l) => {
      if (sort.col === "time") return l.mins == null ? Number.MAX_SAFE_INTEGER : l.mins;
      if (sort.col === "source") return l.sourceLabel.toLowerCase();
      if (sort.col === "name") return (l.name || "").toLowerCase();
      if (sort.col === "property") return (l.propertyAddress || "").toLowerCase();
      return l.intent;
    };
    return [...list].sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [leads, query, sort]);

  const anySim = leads.some((l) => l.simulated) || farms.some((f) => f.simulated);
  const pad = isMobile ? 24 : 32;

  if (booting) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", background: BG }}>
        <style>{MI_KEYFRAMES}</style>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Zap size={46} color={PURPLE_LT} fill={PURPLE_LT}
            style={{ filter: "none", animation: "miBootPulse 1.5s ease-in-out infinite" }} />
          <div className="font-mono tracking-wider text-slate-400" style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: 2.2, color: SLATE_DIM,
            textAlign: "center", padding: "0 24px", lineHeight: 1.7, maxWidth: 480,
          }}>
            SYNCING MACRO TELEMETRY &amp; INBOUND QUEUE...
          </div>
        </div>
      </div>
    );
  }

  const freshCount = leads.filter((l) => l.fresh).length;

  return (
    <div ref={rootRef} className="w-full h-full flex flex-col bg-[#050505] text-white max-w-none" style={{
      position: "relative", width: "100%", maxWidth: "none", height: "100%", minHeight: 0,
      background: BG, color: "#fff", display: "flex", flexDirection: "column", boxSizing: "border-box",
    }}>
      <style>{MI_KEYFRAMES}</style>

      <div className="w-full p-6 md:p-8" style={{
        flex: 1, overflowY: "auto", minHeight: 0, width: "100%", padding: pad, boxSizing: "border-box",
        scrollbarWidth: "thin", scrollbarColor: "#27272a transparent",
      }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ minWidth: 0, marginRight: "auto" }}>
            <div className="tracking-wider text-slate-400" style={{
              fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2.2, color: SLATE_DIM,
              textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 7,
            }}>
              <Radio size={10} color={GREEN} /> Macro-Intelligence &amp; Autonomous Inbound Terminal
            </div>
            <div style={{ fontFamily: F, fontSize: headingSize(bp), fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
              <span className="font-mono" style={{ fontFamily: MONO, color: GREEN, textShadow: "none"}}>
                {leads.length}
              </span>{" "}
              INBOUND IN QUEUE
              {freshCount > 0 && (
                <span className="font-mono" style={{
                  marginLeft: 10, fontFamily: MONO, fontSize: 11, color: GREEN,
                  border: `1px solid ${GREEN}88`, borderRadius: 999, padding: "3px 10px",
                  animation: "miBlink 1.2s ease-in-out infinite", verticalAlign: "middle",
                }}>{freshCount} UNDER 5 MIN</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 11, background: "#111111", border: `1px solid ${HAIRLINE}`, flexWrap: "wrap" }}>
            {VIEWS.map((v) => {
              const I = v.icon;
              const on = view === v.id;
              return (
                <button key={v.id} onClick={() => setView(v.id)} className="font-mono" style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, cursor: "pointer",
                  fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                  background: on ? `${v.color}1e` : "transparent",
                  border: `1px solid ${on ? `${v.color}88` : "transparent"}`,
                  color: on ? v.color : SLATE_DIM,
                  boxShadow: "none", whiteSpace: "nowrap",
                }}>
                  <I size={11} /> [ {v.label} ]
                </button>
              );
            })}
          </div>
        </div>

        {/* HUD */}
        {(() => { const r = kpiRail(bp, { cols: 4 }); return (
        <div className={r.className} style={{ ...r.style, marginBottom: 20 }}>
          <HudCard bp={bp} cardStyle={r.cardStyle} label="30-Day Inbound Velocity" value={hud.leads30} color={GREEN} icon={Inbox}
            sub={`${hud.leads30} lead${hud.leads30 !== 1 ? "s" : ""} · ${hud.cvr.toFixed(1)}% engaged`} />
          <HudCard bp={bp} cardStyle={r.cardStyle} label="YTD GCI Tracker" value={hud.ytd} color={CYAN} icon={Wallet} format="money"
            bar={hud.gciPct ?? 0}
            sub={hud.annualTarget > 0
              ? `${(hud.gciPct ?? 0).toFixed(0)}% of ${fmtMoney(hud.annualTarget)} annual target`
              : "Set a monthly GCI target in My Business"} />
          <HudCard bp={bp} cardStyle={r.cardStyle} label="Local Absorption Rate" value={0} color={AMBER} icon={TrendingUp} format="months"
            unavailable={abs.months == null}
            sub={abs.months == null ? "No sold-listing feed wired up — months of supply can't be computed" : abs.label} />
          <HudCard bp={bp} cardStyle={r.cardStyle} label="Active Micro-Farms" value={hud.farms} color={PURPLE_LT} icon={Target}
            sub={`${hud.farmsMonitored} area${hud.farmsMonitored !== 1 ? "s" : ""} under monitoring`} />
        </div>
        ); })()}

        {anySim && (
          <div className="font-mono" style={{
            fontFamily: MONO, fontSize: 8, lineHeight: 1.6, color: AMBER, marginBottom: 16,
            background: `${AMBER}0d`, border: `1px solid ${AMBER}40`, borderRadius: 8, padding: "8px 11px",
          }}>
            ⚠ DEMO ENVIRONMENT ACTIVE — SIM-BADGED LEADS AND THE MACRO/MICRO-FARM FIGURES ARE SYNTHESIZED SO THE
            TERMINAL IS OPERATIONAL BEFORE REAL DATA LANDS. THIS APP HAS NO HISTORICAL PRICE INDEX OR SOLD-LISTING
            FEED. SIM ROWS NEVER REACH YOUR RECORDS AND THEIR BRIDGES ARE DISABLED.
          </div>
        )}

        {/* ── VIEW 1 · queue ── */}
        {view === "queue" && (
          <>
            <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
              display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 38, borderRadius: 10,
              background: "#111111", border: `1px solid ${HAIRLINE}`, marginBottom: 14, maxWidth: 380,
            }}>
              <Search size={13} color={SLATE_DIM} style={{ flexShrink: 0 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, property, source…"
                className="mi-input"
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: MONO, fontSize: 11, color: "#fff" }} />
              {query && <button onClick={() => setQuery("")} style={{ background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={12} /></button>}
            </div>

            <div className="w-full" style={{ width: "100%", border: `1px solid ${HAIRLINE}`, borderRadius: 12, overflow: "hidden", background: "#111111" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#18181b" }}>
                      {[["time", "Time"], ["source", "Source"], ["name", "Name"], ["property", "Target Property"], ["intent", "AI Intent Score"]].map(([col, label]) => (
                        <th key={col} onClick={() => setSort((s) => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }))}
                          className="tracking-wider" style={{
                            textAlign: "left", padding: "10px 14px", cursor: "pointer", userSelect: "none",
                            fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.2,
                            color: sort.col === col ? GREEN : SLATE_DIM, textTransform: "uppercase",
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
                    {rows.map((l) => (
                      <tr key={l.id} onClick={() => setSelected(l)} className="mi-row" style={{
                        cursor: "pointer", borderBottom: "1px solid #18181b",
                        // Pulsing green rail on uncontacted leads under 5 minutes old.
                        boxShadow: "none",
                        animation: l.fresh ? "miFreshRow 1.8s ease-in-out infinite" : "none",
                      }}>
                        <td className="font-mono" style={{ padding: "11px 14px", fontFamily: MONO, fontSize: 10.5, whiteSpace: "nowrap", color: l.fresh ? GREEN : SLATE }}>
                          {l.ago}
                          {l.fresh && <span style={{ marginLeft: 6, fontSize: 7, letterSpacing: 1 }}>NEW</span>}
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <span className="font-mono" style={{
                            fontFamily: MONO, fontSize: 7.5, fontWeight: 800, color: CYAN, background: `${CYAN}14`,
                            border: `1px solid ${CYAN}44`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap", textTransform: "uppercase",
                          }}>{l.sourceLabel}</span>
                        </td>
                        <td style={{ padding: "11px 14px", maxWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                            {l.simulated && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 6.5, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>SIM</span>}
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", fontFamily: F, fontSize: 11, color: l.propertyAddress ? SLATE : SLATE_DIM, maxWidth: 260 }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {l.propertyAddress || "— not specified —"}
                          </span>
                          {l.propertyPrice && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM }}>{l.propertyPrice}</span>}
                        </td>
                        <td style={{ padding: "11px 14px", minWidth: 130 }}><IntentBar value={l.intent} /></td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className="font-mono" style={{ padding: 28, textAlign: "center", fontFamily: MONO, fontSize: 10, color: SLATE_DIM }}>
                        INBOUND QUEUE IS CLEAR.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── VIEW 2 · macro matrix ── */}
        {view === "macro" && (
          <>
            <div className="grid w-full" style={{
              display: "grid", width: "100%", gap: 16, marginBottom: 16,
              gridTemplateColumns: wide ? "minmax(0,2fr) minmax(0,1fr)" : "minmax(0,1fr)", alignItems: "start",
            }}>
              <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
                padding: 16, borderRadius: 13, background: "#111111", border: `1px solid ${HAIRLINE}`, minWidth: 0,
              }}>
                <div className="tracking-wider" style={{
                  fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.8, color: CYAN,
                  textTransform: "uppercase", marginBottom: 12,
                }}>[ City-Wide Pricing vs Inventory · 12mo ]</div>
                <div style={{ height: chartHeight(bp), width: "100%", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                      <CartesianGrid {...gridProps(bp)} />
                      <XAxis dataKey="month" {...axisProps(bp)} />
                      <YAxis yAxisId="l" {...axisProps(bp)} width={bp.mobile ? 34 : 48} />
                      <YAxis yAxisId="r" orientation="right" {...axisProps(bp)} width={bp.mobile ? 34 : 48} />
                      {/* Rate needs its own scale. Sharing the inventory axis
                          (1200-1600) rendered a 6.2% line flat along the floor,
                          which read as "no data" rather than a rate. */}
                      <YAxis yAxisId="rate" hide domain={["dataMin - 0.6", "dataMax + 0.6"]} />
                      <Tooltip contentStyle={{ background: "#111111", border: `1px solid ${HAIRLINE}`, borderRadius: 9, fontFamily: MONO, fontSize: 11 }}
                        labelStyle={{ color: SLATE_DIM }} />
                      <Legend {...legendProps(bp)} />
                      {/* isAnimationActive={false} on every series — the animation
                          lifecycle does not resolve in this environment and the
                          series render completely empty without it. */}
                      <Area yAxisId="l" type="monotone" dataKey="medianPsf" name="Median $/sqft"
                        stroke={CYAN} fill={`${CYAN}22`} strokeWidth={2} isAnimationActive={false} />
                      <Line yAxisId="r" type="monotone" dataKey="inventory" name="Active inventory"
                        stroke={PURPLE_LT} strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line yAxisId="rate" type="monotone" dataKey="rate" name="30yr rate %"
                        stroke={AMBER} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: AMBER, marginTop: 8, lineHeight: 1.6 }}>
                  ⚠ SIMULATED SERIES — NO HISTORICAL PRICE INDEX OR RATE FEED IS WIRED TO THIS SCREEN.
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
                {(() => {
                  const latest = series[series.length - 1], first = series[0];
                  const psf = ((latest.medianPsf - first.medianPsf) / first.medianPsf) * 100;
                  const inv = ((latest.inventory - first.inventory) / first.inventory) * 100;
                  return [
                    ["Median $/sqft", `$${latest.medianPsf}`, `${psf >= 0 ? "+" : ""}${psf.toFixed(1)}% YoY`, psf >= 0 ? GREEN : RED],
                    ["Active inventory", latest.inventory.toLocaleString(), `${inv >= 0 ? "+" : ""}${inv.toFixed(1)}% YoY`, inv >= 0 ? AMBER : GREEN],
                    ["30-year rate", `${latest.rate}%`, `${(latest.rate - first.rate).toFixed(2)} pts YoY`, latest.rate < first.rate ? GREEN : RED],
                  ].map(([l, v, d, c]) => (
                    <div key={l} className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
                      padding: 14, borderRadius: 12, background: "#111111", border: `1px solid ${HAIRLINE}`,
                    }}>
                      <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.3, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 5 }}>{l}</div>
                      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 21, fontWeight: 800, color: "#fff" }}>{v}</div>
                      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9.5, color: c, marginTop: 3 }}>{d}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* sticky market action engine */}
            <div style={{
              position: "sticky", bottom: 0, zIndex: 40, marginTop: 4,
              background: "linear-gradient(to top, rgba(5,5,5,0.97) 62%, transparent)",
              paddingTop: 14, paddingBottom: 4,
            }}>
              <button onClick={genUpdate} disabled={updating} style={{
                width: "100%", padding: "15px 16px", borderRadius: 12,
                cursor: updating ? "default" : "pointer",
                background: updating ? `${PURPLE}22` : `#8b5cf6`,
                border: `1px solid ${PURPLE}`, color: "#fff",
                fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
                boxShadow: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              }}>
                {updating ? <Loader2 size={14} style={{ animation: "miSpin 1s linear infinite" }} /> : <Send size={14} />}
                {updating ? "Pulling macro data…" : "[ Generate Sphere Market Update ]"}
              </button>
            </div>
          </>
        )}

        {/* ── VIEW 3 · micro-farms ── */}
        {view === "farms" && (
          <div className="grid w-full" style={{
            display: "grid", width: "100%", gap: 14,
            gridTemplateColumns: wide ? "repeat(3, minmax(0,1fr))" : mid ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)",
          }}>
            {farms.map((f) => {
              const ratio = f.active > 0 ? (f.pending / f.active) * 100 : 0;
              const heat = ratio >= 40 ? GREEN : ratio >= 20 ? CYAN : AMBER;
              return (
                <div key={f.id} className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
                  padding: 15, borderRadius: 13, background: "#111111",
                  backdropFilter: "none", WebkitBackdropFilter: "none",
                  border: `1px solid ${HAIRLINE}`, minWidth: 0,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                    <MapPinned size={12} color={heat} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 12.5, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    {f.simulated && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 6.5, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>SIM</span>}
                  </div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>{f.type}</div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                    <div>
                      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 19, fontWeight: 800, color: "#fff" }}>{f.active}</div>
                      <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7, color: SLATE_DIM, textTransform: "uppercase", letterSpacing: 1 }}>Active</div>
                    </div>
                    <span style={{ color: SLATE_DIM, fontFamily: MONO }}>/</span>
                    <div>
                      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 19, fontWeight: 800, color: heat }}>{f.pending}</div>
                      <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7, color: SLATE_DIM, textTransform: "uppercase", letterSpacing: 1 }}>Pending</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div className="font-mono" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: heat }}>{ratio.toFixed(0)}%</div>
                      <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7, color: SLATE_DIM, textTransform: "uppercase", letterSpacing: 1 }}>Under contract</div>
                    </div>
                  </div>

                  <div style={{ height: 5, borderRadius: 3, background: "#27272a", overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ width: `${Math.min(100, ratio)}%`, height: "100%", background: heat, boxShadow: "none", transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, paddingTop: 10, borderTop: `1px solid ${HAIRLINE}` }}>
                    {[["Median $/sf", `$${f.medianPsf}`, "#fff"], ["MoM", `${f.momPct >= 0 ? "+" : ""}${f.momPct}%`, f.momPct >= 0 ? GREEN : RED], ["Avg DOM", `${f.dom}d`, SLATE]].map(([l, v, c]) => (
                      <div key={l} style={{ minWidth: 0 }}>
                        <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 800, color: c, whiteSpace: "nowrap" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* dossier */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{
            position: "absolute", inset: 0, zIndex: 120, background: "#111111",
            backdropFilter: "none", WebkitBackdropFilter: "none",
          }} />
          {/* Mount keyframe, not a framer-motion entrance — see header note 2. */}
          <div key={selected.id} className="backdrop-blur-2xl bg-black/60 border-l border-white/10" style={{
            position: "absolute", top: 0, right: 0, bottom: 0, zIndex: 130,
            width: "min(468px, 100%)", overflowY: "auto",
            animation: "miSlideIn .28s cubic-bezier(.16,1,.3,1) both",
            background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            borderLeft: `1px solid ${HAIRLINE}`, padding: 20, boxSizing: "border-box",
          }}>
            <LeadDossier lead={selected} onClose={() => setSelected(null)} onBridge={bridge} busy={busy} />
          </div>
        </>
      )}

      {/* market update modal */}
      {update && (
        <div onClick={() => setUpdate(null)} style={{
          position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.82)",
          backdropFilter: "none", WebkitBackdropFilter: "none",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
            width: "min(760px,100%)", maxHeight: "88%", overflowY: "auto",
            background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: `1px solid ${PURPLE}55`, borderRadius: 15, padding: 22, boxShadow: "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
              <FileText size={16} color={PURPLE_LT} />
              <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, letterSpacing: 1.2, color: "#fff" }}>SPHERE MARKET UPDATE</span>
              <button onClick={() => setUpdate(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={17} /></button>
            </div>
            <div className="tracking-wider text-slate-400" style={{
              fontFamily: MONO, fontSize: 8, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 15,
            }}>Video script + email blast · review before sending</div>
            <CopyBlock label="Full draft" text={update} />
          </div>
        </div>
      )}

      {toast && (
        <div className="backdrop-blur-2xl" style={{
          position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 250,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: `1px solid ${GREEN}88`, borderRadius: 10, padding: "10px 18px", color: "#fff",
          fontFamily: F, fontSize: 11.5, fontWeight: 700, boxShadow: "none",
          maxWidth: "86%", textAlign: "center",
        }}>{toast}</div>
      )}
    </div>
  );
}

const MI_KEYFRAMES = `
@keyframes miSpin{to{transform:rotate(360deg)}}
@keyframes miBlink{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes miBootPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.9)}}
@keyframes miSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes miPulseBorder{0%,100%{border-color:${AMBER}55;box-shadow:0 0 0 rgba(255,176,32,0)}50%{border-color:${AMBER};box-shadow:0 0 18px rgba(255,176,32,.3)}}
@keyframes miFreshRow{0%,100%{box-shadow:inset 3px 0 0 ${GREEN},0 0 0 rgba(34,197,94,0)}50%{box-shadow:inset 3px 0 0 ${GREEN},inset 0 0 22px rgba(34,197,94,.09)}}
.mi-input::placeholder{color:rgba(148,163,184,0.45)}
.mi-row:hover{background:#18181b}
`;
