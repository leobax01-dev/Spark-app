// src/features/CommandMatrix.jsx — SPARK OS Autonomous Command Matrix.
//
// The agent homepage, rebuilt as a first-person AI proxy terminal: an 8am
// mission briefing split into what needs a human decision versus what SPARK
// already handled, a spoken briefing, a live specialist roster, and an
// omni-command bar that refuses to write anything without an explicit
// confirmation tap.
//
// Standing adaptations, same rationale as every other SPARK OS terminal:
//
// 1. Styling: no Tailwind is configured in this app — requested className
//    strings are kept (free upgrade if Tailwind ever lands) and backed by
//    equivalent inline styles.
//
// 2. Animation: framer-motion is used ONLY for imperative value tickers.
//    No content is gated behind an entrance/exit animation — staggered and
//    presence-based animations do not reliably resolve in embedded or
//    throttled contexts here, and a stalled one would leave an agent staring
//    at an empty briefing.
//
// 3. Background-operations honesty. Panel B reports what this system
//    genuinely did — engine runs, client scoring, sphere scans, listing
//    refreshes, market-context pulls — and each line is gated on the artifact
//    that proves it ran. utils/compliance is a fair-housing LANGUAGE review of
//    outbound copy, not a disclosure-file audit, so no op claims otherwise.
//    Every synthesized row is badged SIM, because an agent must never believe
//    a check ran when nothing checked anything.
//
// 4. The confirmation loop actually executes. Stage moves and notes write to
//    the real client store and sync; everything else routes to the live chat
//    pipeline. Nothing in the modal claims a write the executor does not
//    perform — see EXECUTORS.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "framer-motion";
import {
  Zap, Mic, Send, X, ShieldAlert, MessageSquare, Terminal, ChevronRight,
  CheckCircle2, Loader2, FileText, Handshake, LineChart, GraduationCap,
  AlertTriangle, Paperclip,
} from "lucide-react";
import { lsGet, lsSet, cloudSync } from "../utils/storage";
import { useContainerWidth, breakpoints, kpiRail, figureSize, headingSize } from "../responsive";
import { buildBriefing, HIGH_DOM } from "./briefing";

// ── design tokens ─────────────────────────────────────────────────────────
const BG = "#050505";
const CYAN = "#38bdf8";
const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const GREEN = "#10b981";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";
const HAIRLINE = "#27272a";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CLIENTS_KEY = "spark_clients_v1";
const VALID_STAGES = ["prospect", "active", "contract", "closed"];
const STAGE_ALIASES = {
  "under contract": "contract", contract: "contract", pending: "contract",
  prospect: "prospect", lead: "prospect", new: "prospect",
  active: "active", showing: "active", "actively looking": "active",
  closed: "closed", "closed won": "closed", sold: "closed",
};

// ── formatting ────────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtFull(n) { return `$${Math.round(n || 0).toLocaleString()}`; }

// Tailwind's `md:`/`lg:` prefixes do nothing in this app (no Tailwind build),
// so the two breakpoints the layout depends on are resolved in JS.
//
// Measured against the CONTAINER, not the viewport: this panel renders beside
// a ~250px sidebar, so a 1100px window leaves an ~850px panel that must not be
// laid out as `lg`. Thresholds are the Tailwind values minus a typical sidebar
// (1024→780, 768→560), which keeps the intent at full width and stays correct
// when the sidebar is absent (mobile) or present (desktop).
const BP_SPLIT = 780; // lg: — 7/5 command split
const BP_TICKER = 560; // md: — 3-up ticker grid


// ── framer-motion value ticker ────────────────────────────────────────────
// Imperative only. The rendered value is plain state driven by onUpdate, so a
// stalled animation can never hide the number — worst case it appears
// instantly at its final value.
function useTicker(target, { duration = 1.1 } = {}) {
  const [shown, setShown] = useState(target || 0);
  const prev = useRef(target || 0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(target) || 0;
    prev.current = to;
    if (from === to) { setShown(to); return; }
    const controls = animate(from, to, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
      onComplete: () => setShown(to),
    });
    return () => controls.stop();
  }, [target, duration]);
  return shown;
}

// ── GCI ticker card ───────────────────────────────────────────────────────
function TickerCard({ bp, cardStyle, label, value, sub, color, format = "money", icon: IconCmp }) {
  const shown = useTicker(value);
  const text = format === "pct" ? `${Math.round(shown)}%`
    : format === "full" ? fmtFull(shown)
      : fmtMoney(shown);
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      minWidth: 0, padding: 14, borderRadius: 13, ...cardStyle,
      background: `#111111`,
      backdropFilter: "none", WebkitBackdropFilter: "none",
      border: `1px solid ${color}33`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        {IconCmp && <IconCmp size={11} color={color} />}
        <span className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.5,
          color: SLATE_DIM, textTransform: "uppercase", lineHeight: 1.35,
        }}>[ {label} ]</span>
      </div>
      <div className="font-mono" style={{
        fontFamily: MONO, fontSize: figureSize(bp || {}), fontWeight: 800, color,
        lineHeight: 1.1, whiteSpace: "nowrap",
      }}>{text}</div>
      <div style={{ fontFamily: F, fontSize: 9.5, color: SLATE_DIM, marginTop: "auto", paddingTop: 6, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

// ── threat card (Panel A) ─────────────────────────────────────────────────
function ThreatCard({ threat, onSituationRoom, onTalkThrough }) {
  const tone = threat.severity === "critical" ? RED : AMBER;
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      borderRadius: 13, padding: 14, marginBottom: 11,
      background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
      border: `1px solid ${tone}3d`, boxShadow: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="font-mono" style={{
          fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 0.9, color: tone,
          background: `${tone}16`, border: `1px solid ${tone}55`, borderRadius: 999, padding: "3px 9px",
        }}>{threat.severity === "critical" ? "CRITICAL" : "HIGH"}</span>
        <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, letterSpacing: 0.8 }}>
          {threat.kind}
        </span>
        {threat.simulated && (
          <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "2px 5px" }}>SIM</span>
        )}
        {threat.value > 0 && (
          <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: tone, marginLeft: "auto" }}>
            {fmtFull(threat.value)}
          </span>
        )}
      </div>

      <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.4, marginBottom: 5 }}>
        {threat.subject}
      </div>
      <div style={{ fontFamily: F, fontSize: 11.5, color: SLATE, lineHeight: 1.6, marginBottom: 10 }}>
        {threat.detail}
      </div>

      {threat.action && (
        <div style={{
          borderLeft: `2px solid ${tone}77`, paddingLeft: 9, marginBottom: 12,
          fontFamily: F, fontSize: 11, color: SLATE_DIM, lineHeight: 1.55,
        }}>
          <span className="tracking-wider" style={{ color: tone, fontFamily: MONO, fontSize: 8, letterSpacing: 1.2 }}>RECOMMENDED · </span>
          {threat.action}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => onSituationRoom(threat)}
          style={{
            flex: "1 1 auto", minWidth: 150, padding: "10px 12px", borderRadius: 9, cursor: "pointer",
            background: `${tone}1c`, border: `1px solid ${tone}88`, color: tone,
            fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            boxShadow: "none",
          }}>
          <ShieldAlert size={12} /> [ Enter Situation Room ]
        </button>
        <button onClick={() => onTalkThrough(threat)}
          style={{
            flex: "1 1 auto", minWidth: 150, padding: "10px 12px", borderRadius: 9, cursor: "pointer",
            background: `${PURPLE}1c`, border: `1px solid ${PURPLE}88`, color: PURPLE_LT,
            fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
          <MessageSquare size={12} /> [ Talk This Through ]
        </button>
      </div>
    </div>
  );
}

// ── background operations terminal (Panel B) ──────────────────────────────
function BackgroundOps({ ops }) {
  return (
    <div style={{
      borderRadius: 11, border: `1px solid ${HAIRLINE}`, background: "#111111",
      overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <div className="font-mono" style={{
        display: "flex", alignItems: "center", gap: 7, padding: "8px 12px",
        borderBottom: `1px solid ${HAIRLINE}`, background: "#18181b",
        fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.4, color: SLATE_DIM, textTransform: "uppercase",
      }}>
        <Terminal size={10} color={GREEN} />
        spark://background · {ops.length} op{ops.length !== 1 ? "s" : ""}
        <span style={{ marginLeft: "auto", color: GREEN, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, boxShadow: "none", animation: "none" }} />
          LIVE
        </span>
      </div>

      <div style={{ overflowY: "auto", maxHeight: 300, padding: "4px 0" }}>
        {ops.length === 0 && (
          <div className="font-mono" style={{ fontFamily: MONO, fontSize: 10, color: SLATE_DIM, padding: "16px 12px", textAlign: "center" }}>
            NO BACKGROUND OPERATIONS THIS CYCLE.
          </div>
        )}
        {ops.map((op) => (
          <div key={op.id} className="font-mono" style={{
            display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 12px",
            fontFamily: MONO, fontSize: 10, lineHeight: 1.5,
            borderBottom: "1px solid #18181b",
          }}>
            <span style={{ color: SLATE_DIM, flexShrink: 0, fontSize: 9 }}>{op.at}</span>
            {op.pending
              ? <Loader2 size={10} color={CYAN} style={{ flexShrink: 0, marginTop: 2, animation: "cmSpin 1s linear infinite" }} />
              : <CheckCircle2 size={10} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />}
            <span style={{ flex: 1, color: op.pending ? CYAN : SLATE, minWidth: 0 }}>
              {op.text}
              {op.simulated && (
                <span style={{ color: AMBER, marginLeft: 6, fontSize: 8, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 4px" }}>SIM</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── specialist dock ───────────────────────────────────────────────────────
const SPECIALISTS = [
  { id: "coordinator", label: "Transaction Coordinator", icon: FileText, color: CYAN },
  { id: "negotiate", label: "Negotiation Copilot", icon: Handshake, color: PURPLE },
  { id: "listings", label: "Listing Analyst", icon: LineChart, color: AMBER },
  { id: "coaching", label: "Business Coach", icon: GraduationCap, color: GREEN },
];

function SpecialistDock({ statuses, onOpen }) {
  return (
    <div>
      <div className="tracking-wider text-slate-400" style={{
        fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2,
        color: SLATE_DIM, textTransform: "uppercase", marginBottom: 9,
      }}>[ Active Specialist Roster ] · 4 proxies online</div>

      <div style={{
        display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6,
        scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,.08) transparent",
      }}>
        {SPECIALISTS.map((s) => {
          const st = statuses[s.id] || { text: "Standing by", tone: "calm" };
          const dot = st.tone === "warn" ? AMBER : st.tone === "idle" ? SLATE_DIM : GREEN;
          const IconCmp = s.icon;
          return (
            <button key={s.id} onClick={() => onOpen(s.id)}
              className="backdrop-blur-2xl bg-black/60 border border-white/10"
              style={{
                flex: "0 0 214px", width: 214, textAlign: "left", cursor: "pointer",
                padding: 13, borderRadius: 12,
                background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
                border: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", gap: 9,
                transition: "border-color .16s ease, background .16s ease",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 27, height: 27, borderRadius: 8, flexShrink: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: `${s.color}18`, border: `1px solid ${s.color}44`,
                }}>
                  <IconCmp size={13} color={s.color} />
                </div>
                <span style={{
                  flex: 1, minWidth: 0, fontFamily: F, fontSize: 11, fontWeight: 800, color: "#fff",
                  lineHeight: 1.25,
                }}>{s.label}</span>
                <ChevronRight size={12} color={SLATE_DIM} style={{ flexShrink: 0 }} />
              </div>

              {/* flex-start so the dot tracks the first line when status wraps */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ position: "relative", width: 6, height: 6, flexShrink: 0, marginTop: 4 }}>
                  <span style={{
                    position: "absolute", inset: -3, borderRadius: "50%", border: `1px solid ${dot}`,
                    animation: "none",
                  }} />
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: dot, boxShadow: "none"}} />
                </span>
                <span className="font-mono" style={{
                  flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 9, color: SLATE_DIM, lineHeight: 1.4,
                }}>{st.text}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── omni-command intent parser ────────────────────────────────────────────
// Deterministic and local. A remote parse would add a network round-trip and
// a failure mode to something the agent is about to authorize — better that
// what the modal shows is exactly what the executor will run.
function matchClient(name, clients) {
  if (!name) return null;
  const q = name.trim().toLowerCase();
  return clients.find((c) => c.name?.toLowerCase() === q)
    || clients.find((c) => c.name?.toLowerCase().startsWith(q))
    || clients.find((c) => c.name?.toLowerCase().includes(q))
    || null;
}

function parseCommand(raw, clients) {
  const text = String(raw || "").trim();
  if (!text) return null;

  // "move Sarah to under contract"
  const move = text.match(/^(?:move|set|change|mark)\s+(.+?)\s+(?:to|as|into)\s+(.+?)[.!]?$/i);
  if (move) {
    const stageRaw = move[2].trim().toLowerCase().replace(/^the\s+/, "");
    const stage = STAGE_ALIASES[stageRaw] || (VALID_STAGES.includes(stageRaw) ? stageRaw : null);
    if (stage) {
      const client = matchClient(move[1], clients);
      return {
        intent: "UPDATE_CLIENT_STAGE",
        confidence: client ? "high" : "unresolved",
        entities: { client: client?.name || move[1].trim(), stage_from: client?.stage || null, stage_to: stage },
        effect: client
          ? `Writes stage="${stage}" to client record and syncs to cloud.`
          : `No client matches "${move[1].trim()}" — nothing will be written.`,
        reversible: true,
        executable: !!client,
        _client: client,
      };
    }
  }

  // "note for Sarah: they want to see the Elm St place"
  const note = text.match(/^(?:add\s+)?(?:a\s+)?note\s+(?:for|on|about)\s+(.+?)\s*[:—-]\s*(.+)$/i);
  if (note) {
    const client = matchClient(note[1], clients);
    return {
      intent: "APPEND_CLIENT_NOTE",
      confidence: client ? "high" : "unresolved",
      entities: { client: client?.name || note[1].trim(), note: note[2].trim() },
      effect: client
        ? "Appends a timestamped note to the client record and syncs to cloud."
        : `No client matches "${note[1].trim()}" — nothing will be written.`,
      reversible: true,
      executable: !!client,
      _client: client,
    };
  }

  // "draft an email to David about the price adjustment"
  const draft = text.match(/^(?:draft|write|compose)\s+(?:an?\s+)?(email|text|message|script|update)\s+(?:to|for)\s+(.+?)(?:\s+about\s+(.+))?[.!]?$/i);
  if (draft) {
    const client = matchClient(draft[2], clients);
    return {
      intent: "DRAFT_COMMUNICATION",
      confidence: "high",
      entities: { channel: draft[1].toLowerCase(), recipient: client?.name || draft[2].trim(), topic: draft[3]?.trim() || null },
      effect: "Sends the request to SPARK chat and returns a draft for your review. Nothing is sent to the recipient.",
      reversible: true,
      executable: true,
      _prompt: `Draft a ${draft[1].toLowerCase()} to ${client?.name || draft[2].trim()}${draft[3] ? ` about ${draft[3].trim()}` : ""}. Use my voice and keep it ready to send.`,
    };
  }

  // "open the negotiation copilot"
  const open = text.match(/^(?:open|show|go to|launch)\s+(?:the\s+)?(.+?)[.!]?$/i);
  if (open) {
    const q = open[1].toLowerCase();
    const hit = SPECIALISTS.find((s) => s.label.toLowerCase().includes(q) || q.includes(s.id));
    if (hit) {
      return {
        intent: "OPEN_SPECIALIST",
        confidence: "high",
        entities: { specialist: hit.label, id: hit.id },
        effect: `Opens the ${hit.label} workspace. Read-only navigation.`,
        reversible: true, executable: true, _specialist: hit.id,
      };
    }
  }

  // Everything else is a question for SPARK, not a mutation.
  return {
    intent: "ASK_SPARK",
    confidence: "high",
    entities: { query: text },
    effect: "Sends this to SPARK chat for a strategic answer. No records are modified.",
    reversible: true, executable: true, _prompt: text,
  };
}

// ── confirmation modal ────────────────────────────────────────────────────
function ConfirmModal({ plan, busy, onCancel, onConfirm }) {
  if (!plan) return null;
  const mutating = plan.intent === "UPDATE_CLIENT_STAGE" || plan.intent === "APPEND_CLIENT_NOTE";
  const json = JSON.stringify({
    intent: plan.intent,
    confidence: plan.confidence,
    entities: plan.entities,
    writes_to_record: mutating,
    reversible: plan.reversible,
  }, null, 2);

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)",
      backdropFilter: "none", WebkitBackdropFilter: "none",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()}
        className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          width: "min(540px,100%)", maxHeight: "88%", overflowY: "auto",
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: `1px solid ${PURPLE}55`, borderRadius: 15, padding: 20,
          boxShadow: "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
          <AlertTriangle size={15} color={PURPLE_LT} />
          <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, letterSpacing: 1.2, color: "#fff" }}>
            CONFIRM BEFORE EXECUTION
          </span>
          <button onClick={onCancel} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: 1.8, color: SLATE_DIM,
          textTransform: "uppercase", marginBottom: 14,
        }}>Parsed intent · nothing is saved until you confirm</div>

        <pre className="bg-black/80 font-mono" style={{
          background: "rgba(0,0,0,0.75)", border: `1px solid ${HAIRLINE}`, borderRadius: 10,
          padding: 13, fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: CYAN,
          whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 12px",
        }}>{json}</pre>

        <div style={{
          border: `1px solid ${mutating ? AMBER : HAIRLINE}44`, borderRadius: 10, padding: 12, marginBottom: 16,
          background: mutating ? `${AMBER}0c` : "#18181b",
        }}>
          <div className="tracking-wider" style={{
            fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.4, color: mutating ? AMBER : SLATE_DIM,
            textTransform: "uppercase", marginBottom: 5,
          }}>{mutating ? "⚠ This writes to your records" : "Effect"}</div>
          <div style={{ fontFamily: F, fontSize: 11.5, color: SLATE, lineHeight: 1.6 }}>{plan.effect}</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onCancel} disabled={busy}
            style={{
              flex: "1 1 150px", padding: "14px 16px", borderRadius: 11, cursor: busy ? "default" : "pointer",
              background: "transparent", border: `1px solid ${HAIRLINE}`, color: SLATE,
              fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
            }}>
            [ Cancel / Revise ]
          </button>
          <button onClick={onConfirm} disabled={busy || !plan.executable}
            title={plan.executable ? undefined : "Nothing to execute — revise the command"}
            style={{
              flex: "2 1 230px", padding: "14px 16px", borderRadius: 11,
              cursor: busy || !plan.executable ? "default" : "pointer",
              background: plan.executable ? `#8b5cf6` : "rgba(255,255,255,0.05)",
              border: `1px solid ${plan.executable ? PURPLE : HAIRLINE}`,
              color: plan.executable ? "#fff" : SLATE_DIM,
              fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
              boxShadow: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? <Loader2 size={14} style={{ animation: "cmSpin 1s linear infinite" }} /> : <Zap size={14} />}
            {busy ? "Executing…" : "[ Confirm & Execute ]"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── omni-command bar ──────────────────────────────────────────────────────
function OmniCommand({ onSubmit, listening, onToggleMic, micSupported, transcript, pad = 32 }) {
  const [text, setText] = useState("");
  useEffect(() => { if (transcript) setText(transcript); }, [transcript]);

  const fire = () => { if (!text.trim()) return; onSubmit(text); setText(""); };

  return (
    // Full-width footer band; the input itself is capped and centred inside it
    // so the command line stays reachable rather than stretching to 2000px on
    // an ultrawide monitor.
    <div className="w-full" style={{
      flexShrink: 0, width: "100%", padding: `12px ${pad}px 16px`, boxSizing: "border-box",
      borderTop: `1px solid ${HAIRLINE}`, background: "#111111",
      backdropFilter: "none", WebkitBackdropFilter: "none",
    }}>
      <div className="max-w-4xl mx-auto w-full" style={{ maxWidth: 896, margin: "0 auto", width: "100%" }}>
      <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14,
        background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
        border: `1px solid ${listening ? `${PURPLE}88` : HAIRLINE}`,
        boxShadow: "none",
      }}>
        <button onClick={onToggleMic} disabled={!micSupported}
          title={micSupported ? (listening ? "Stop dictation" : "Speak a command") : "Speech recognition unavailable in this browser"}
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: listening ? `#8b5cf6` : `${PURPLE}18`,
            border: `1px solid ${PURPLE}${listening ? "" : "55"}`,
            color: listening ? "#fff" : PURPLE_LT,
            cursor: micSupported ? "pointer" : "not-allowed", opacity: micSupported ? 1 : 0.45,
            boxShadow: "none",
            animation: listening ? "cmGlow 1.4s ease-in-out infinite" : "none",
          }}>
          <Mic size={15} />
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fire(); } }}
          placeholder={listening ? "Listening…" : "Speak, type, or drop a document…"}
          className="cm-omni"
          style={{
            flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
            fontFamily: MONO, fontSize: 12, color: "#fff", letterSpacing: 0.2,
          }}
        />

        <span title="Document intake is not wired up yet" style={{ flexShrink: 0, display: "flex", alignItems: "center", color: "rgba(148,163,184,0.35)" }}>
          <Paperclip size={14} />
        </span>

        <button onClick={fire} disabled={!text.trim()}
          style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: text.trim() ? `${CYAN}1e` : "transparent",
            border: `1px solid ${text.trim() ? `${CYAN}88` : HAIRLINE}`,
            color: text.trim() ? CYAN : SLATE_DIM,
            cursor: text.trim() ? "pointer" : "default",
          }}>
          <Send size={14} />
        </button>
      </div>
      <div className="font-mono" style={{
        fontFamily: MONO, fontSize: 7.5, color: "rgba(148,163,184,0.42)", letterSpacing: 1,
        textAlign: "center", marginTop: 6, textTransform: "uppercase",
      }}>
        Every command requires explicit confirmation before anything is written
      </div>
      </div>
    </div>
  );
}

// The local record is the authoritative write; the cloud push can fail
// independently (offline, no serverless runtime in dev). Saying "saved" flat
// when it only saved locally would let an agent close their laptop believing
// a stage change had propagated, so the two are reported separately.
function syncNote(synced, user) {
  if (synced) return "";
  if (!user?.email) return " Saved on this device (not signed in to sync).";
  return " Saved on this device — cloud sync failed, it will retry on next sync.";
}

// ── main component ────────────────────────────────────────────────────────
export default function CommandMatrix({
  loading, isDemo, voice, user, apResult, sphere, listingPerf, lastRun,
  pipelineValue = 0, specialistStatuses = {}, briefing: briefingProp, pad = 32,
  onOpenSituationRoom, onTalkThrough, onOpenSpecialist, onDiscuss,
  micSupported, listening, onToggleMic, transcript,
}) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const rootRef = useRef(null);
  const cw = useContainerWidth(rootRef);
  // Before the observer's first measurement cw is 0; assume wide so the
  // desktop layout paints on the first frame instead of flashing single-column.
  const wide = cw === 0 || cw >= BP_SPLIT;
  const bp = breakpoints(cw);
  const md = cw === 0 || cw >= BP_TICKER;

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);

  const demo = isDemo || !apResult;

  // ── briefing assembly ───────────────────────────────────────────────────
  // The parent computes this so the header's audio module and this body share
  // one briefing; falling back to building it here keeps the component usable
  // standalone.
  const briefing = useMemo(
    () => briefingProp || buildBriefing({
      isDemo: demo, apResult, sphere, listingPerf, lastRun, pipelineValue, specialistStatuses,
    }),
    [briefingProp, demo, apResult, sphere, listingPerf, lastRun, pipelineValue, specialistStatuses],
  );


  // ── command execution ───────────────────────────────────────────────────
  const submitCommand = useCallback((text) => {
    const clients = lsGet(CLIENTS_KEY, []) || [];
    const parsed = parseCommand(text, clients);
    if (parsed) setPlan(parsed);
  }, []);

  const execute = useCallback(async () => {
    if (!plan?.executable) return;
    setBusy(true);
    try {
      if (plan.intent === "UPDATE_CLIENT_STAGE") {
        const clients = lsGet(CLIENTS_KEY, []) || [];
        const updated = clients.map((c) =>
          c.id === plan._client.id ? { ...c, stage: plan.entities.stage_to, updatedAt: new Date().toISOString() } : c);
        lsSet(CLIENTS_KEY, updated);
        const synced = user?.email ? await cloudSync(user.email, { clients: updated }) : false;
        setToast(`${plan.entities.client} moved to ${plan.entities.stage_to}.${syncNote(synced, user)}`);
      } else if (plan.intent === "APPEND_CLIENT_NOTE") {
        const clients = lsGet(CLIENTS_KEY, []) || [];
        const stamp = new Date().toLocaleString();
        const updated = clients.map((c) =>
          c.id === plan._client.id
            ? { ...c, notes: `${c.notes ? `${c.notes}\n` : ""}[${stamp}] ${plan.entities.note}`, updatedAt: new Date().toISOString() }
            : c);
        lsSet(CLIENTS_KEY, updated);
        const synced = user?.email ? await cloudSync(user.email, { clients: updated }) : false;
        setToast(`Note saved to ${plan.entities.client}.${syncNote(synced, user)}`);
      } else if (plan.intent === "OPEN_SPECIALIST") {
        onOpenSpecialist?.(plan._specialist);
      } else {
        onDiscuss?.(plan._prompt);
      }
      setPlan(null);
    } catch (err) {
      setToast(`Execution failed — ${err.message || "unknown error"}. Nothing was saved.`);
    } finally {
      setBusy(false);
    }
  }, [plan, user, onOpenSpecialist, onDiscuss]);

  if (loading) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", background: BG }}>
        <style>{CM_KEYFRAMES}</style>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 18,
        }}>
          <Zap size={46} color={PURPLE_LT} fill={PURPLE_LT}
            style={{ filter: "none", animation: "cmBootPulse 1.5s ease-in-out infinite" }} />
          <div className="font-mono tracking-wider text-slate-400" style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: 2.2, color: SLATE_DIM,
            textAlign: "center", padding: "0 24px", lineHeight: 1.7, maxWidth: 460,
          }}>
            DECRYPTING 8AM PIPELINE INTELLIGENCE &amp; ACTIVATING SPECIALIST ROSTER...
          </div>
        </div>
      </div>
    );
  }

  const m = briefing.metrics;

  return (
    <div ref={rootRef} className="w-full h-full flex flex-col bg-[#050505] text-white max-w-none" style={{
      position: "relative", width: "100%", maxWidth: "none", height: "100%", background: BG,
      color: "#fff", display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <style>{CM_KEYFRAMES}</style>

      {/* ── scrolling body ── p-6 md:p-8, no max-width, no auto margins ── */}
      <div className="w-full p-6 md:p-8" style={{
        flex: 1, overflowY: "auto", minHeight: 0, width: "100%",
        padding: pad, boxSizing: "border-box",
        scrollbarWidth: "thin", scrollbarColor: "#27272a transparent",
      }}>

        {/* ── Pipeline wealth banner (full width) ── */}
        <div className="w-full" style={{ width: "100%", marginBottom: 18 }}>
          <div style={{
            fontFamily: F, fontSize: headingSize(bp, 22), fontWeight: 800, lineHeight: 1.25, color: "#fff",
            textShadow: "none",
          }}>
            <span className="font-mono" style={{ fontFamily: MONO, color: CYAN, textShadow: "none"}}>
              {fmtMoney(briefing.pipelineValue)}
            </span>{" "}
            IN PIPELINE WEALTH BEING ACTIVELY PROTECTED
          </div>
          {briefing.simulated && (
            <div className="font-mono tracking-wider" style={{
              fontFamily: MONO, fontSize: 8, letterSpacing: 1.6, color: AMBER, marginTop: 6,
              textTransform: "uppercase",
            }}>
              ⚠ Live example — synthesized for a fictional agent until your own data is in
            </div>
          )}
        </div>

        {/* ── GCI ticker grid: 1 col → 3 cols, full width ── */}
        {/* Explicit tracks, not auto-fit: auto-fit produced a phantom 4th
            column at desktop width whose gap pushed the grid past 100%. */}
        {(() => { const r = kpiRail(bp, { cols: 3 }); return (
        <div className={r.className} style={{ ...r.style, marginBottom: 22 }}>
          <TickerCard bp={bp} cardStyle={r.cardStyle} label="Commission at Risk" value={m.atRisk} color={RED} icon={AlertTriangle}
            sub="Slippage exposure from stalled and deadline-bound deals" />
          <TickerCard bp={bp} cardStyle={r.cardStyle} label="Opportunity Surfaced" value={m.opportunity} color={GREEN} icon={Zap}
            sub="Sphere reactivation and dormant-lead upside found this cycle" />
          <TickerCard bp={bp} cardStyle={r.cardStyle} label="Pipeline Probability" value={m.probability} color={CYAN} format="pct" icon={LineChart}
            sub="Average close score across every scored client" />
        </div>
        ); })()}

        {/* ── Main command split: 12-col grid, 7/5 at lg and up ──
            Tailwind is not configured in this app, so the requested grid
            classes are kept for the day it lands and backed by the equivalent
            inline grid. `minmax(0,Xfr)` rather than `Xfr` so long threat text
            cannot blow the column past its track. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full" style={{
          display: "grid", width: "100%", gap: 22, marginBottom: 22, alignItems: "start",
          gridTemplateColumns: wide ? "minmax(0,7fr) minmax(0,5fr)" : "minmax(0,1fr)",
        }}>

          {/* Panel A — lg:col-span-7 */}
          <div className="lg:col-span-7" style={{ minWidth: 0 }}>
            <div className="tracking-wider" style={{
              fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2,
              color: RED, textTransform: "uppercase", marginBottom: 9,
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <ShieldAlert size={11} color={RED} />
              [ Requires Operator Judgment ]
              <span style={{ marginLeft: "auto", color: SLATE_DIM }}>{briefing.threats.length}</span>
            </div>

            {briefing.threats.length === 0 ? (
              <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
                borderRadius: 12, padding: 22, textAlign: "center",
                background: "#111111", border: `1px solid ${HAIRLINE}`,
              }}>
                <CheckCircle2 size={22} color={GREEN} style={{ marginBottom: 9 }} />
                <div style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                  Nothing needs your judgment right now.
                </div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9.5, color: SLATE_DIM, lineHeight: 1.6 }}>
                  SPARK IS HOLDING THE LINE. YOU WILL BE INTERRUPTED IF THAT CHANGES.
                </div>
              </div>
            ) : briefing.threats.map((t) => (
              <ThreatCard key={t.id} threat={t}
                onSituationRoom={() => onOpenSituationRoom?.(t._raw || t)}
                onTalkThrough={() => onTalkThrough?.(t)} />
            ))}
          </div>

          {/* Panel B — lg:col-span-5 */}
          <div className="lg:col-span-5" style={{ minWidth: 0 }}>
            <div className="tracking-wider" style={{
              fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2,
              color: GREEN, textTransform: "uppercase", marginBottom: 9,
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <Terminal size={11} color={GREEN} />
              [ Background Operations Executing ]
            </div>
            <BackgroundOps ops={briefing.ops} />

            {briefing.simulated && (
              <div className="font-mono" style={{
                marginTop: 10, fontFamily: MONO, fontSize: 7.5, lineHeight: 1.6, color: AMBER,
                background: `${AMBER}0f`, border: `1px solid ${AMBER}44`, borderRadius: 8, padding: "8px 10px",
              }}>
                ⚠ LIVE EXAMPLE — THIS BRIEFING IS SYNTHESIZED FOR A FICTIONAL AGENT SO YOU CAN SEE A
                FULL 8AM CYCLE BEFORE YOUR OWN DATA IS IN. NO REAL RECORD WAS READ OR WRITTEN.
              </div>
            )}
          </div>
        </div>

        {/* ── Specialist roster dock ── */}
        <div style={{ marginBottom: 8 }}>
          <SpecialistDock statuses={briefing.specialists} onOpen={(id) => onOpenSpecialist?.(id)} />
        </div>
      </div>

      {/* ── Omni-command bar ── */}
      <OmniCommand onSubmit={submitCommand} listening={listening} onToggleMic={onToggleMic}
        micSupported={micSupported} transcript={transcript} pad={pad} />

      <ConfirmModal plan={plan} busy={busy} onCancel={() => setPlan(null)} onConfirm={execute} />

      {toast && (
        <div className="backdrop-blur-2xl" style={{
          position: "absolute", bottom: 78, left: "50%", transform: "translateX(-50%)", zIndex: 210,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: `1px solid ${CYAN}88`, borderRadius: 10, padding: "10px 18px", color: "#fff",
          fontFamily: F, fontSize: 11.5, fontWeight: 700, boxShadow: "none",
          maxWidth: "88%", textAlign: "center",
        }}>{toast}</div>
      )}
    </div>
  );
}

const CM_KEYFRAMES = `
@keyframes cmPulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(2.6);opacity:0}}
@keyframes cmSpin{to{transform:rotate(360deg)}}
@keyframes cmBlink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes cmBar{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}
@keyframes cmGlow{0%,100%{box-shadow:0 0 14px ${PURPLE}88}50%{box-shadow:0 0 26px ${PURPLE}}}
@keyframes cmBootPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.9)}}
.cm-omni::placeholder{color:rgba(148,163,184,0.45)}
`;
