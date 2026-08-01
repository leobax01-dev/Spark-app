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
  Zap, Play, Pause, Volume2, VolumeX, Mic, Send, X, ShieldAlert, Radio,
  ArrowRight, MessageSquare, Terminal, ChevronRight, CheckCircle2, Loader2,
  FileText, Handshake, LineChart, GraduationCap, AlertTriangle, Paperclip,
} from "lucide-react";
import { lsGet, lsSet, cloudSync } from "../utils/storage";

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
const HAIRLINE = "rgba(255,255,255,0.1)";

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
function clockOf(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

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

// ── spoken briefing player ────────────────────────────────────────────────
function BriefingAudio({ text, compact }) {
  const [state, setState] = useState("idle"); // idle | playing | paused
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(true);
  const synthRef = useRef(null);
  const uttRef = useRef(null);

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    synthRef.current = synth;
    setSupported(!!synth);
    return () => { try { synth?.cancel(); } catch { /* nothing playing */ } };
  }, []);

  const speak = useCallback(() => {
    const synth = synthRef.current;
    if (!synth || !text) return;
    synth.cancel();
    const clean = String(text)
      .replace(/\*\*(.*?)\*\*/g, "$1").replace(/[#*_`>]/g, "")
      .replace(/\n+/g, ". ").slice(0, 1400);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 0.98; utt.pitch = 1; utt.volume = muted ? 0 : 1;
    const voices = synth.getVoices() || [];
    const preferred = voices.find((v) =>
      /Samantha|Google US English|Microsoft Aria|Alex/.test(v.name));
    if (preferred) utt.voice = preferred;
    utt.onend = () => setState("idle");
    utt.onerror = () => setState("idle");
    uttRef.current = utt;
    synth.speak(utt);
    setState("playing");
  }, [text, muted]);

  const toggle = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) return;
    if (state === "playing") { synth.pause(); setState("paused"); return; }
    if (state === "paused") { synth.resume(); setState("playing"); return; }
    speak();
  }, [state, speak]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      // The Web Speech API has no live volume control on an in-flight
      // utterance — muting mid-sentence has to restart it at volume 0.
      if (state === "playing" && uttRef.current) {
        const synth = synthRef.current;
        synth?.cancel();
        setState("idle");
      }
      return next;
    });
  }, [state]);

  const playing = state === "playing";

  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      padding: compact ? "7px 10px" : "8px 12px", borderRadius: 12,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
      border: `1px solid ${HAIRLINE}`,
    }}>
      <button onClick={toggle} disabled={!supported || !text} title={supported ? "Play the 8am briefing" : "Speech synthesis unavailable in this browser"}
        style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: playing ? `${PURPLE}22` : `linear-gradient(135deg,#7c3aed,${PURPLE})`,
          border: `1px solid ${PURPLE}88`, color: "#fff",
          cursor: supported && text ? "pointer" : "not-allowed",
          opacity: supported && text ? 1 : 0.45,
          boxShadow: playing ? `0 0 14px ${PURPLE}77` : "none",
        }}>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>

      {/* Visualizer — animates only while actually speaking. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 18, width: 46, flexShrink: 0 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} style={{
            flex: 1, borderRadius: 1, background: playing ? PURPLE_LT : "rgba(148,163,184,0.28)",
            height: playing ? "100%" : 3,
            transformOrigin: "bottom",
            animation: playing ? `cmBar 0.9s ease-in-out ${i * 0.09}s infinite` : "none",
            boxShadow: playing ? `0 0 6px ${PURPLE}88` : "none",
          }} />
        ))}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase",
        }}>8AM Audio Briefing</div>
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9.5, color: playing ? PURPLE_LT : SLATE, whiteSpace: "nowrap" }}>
          {!supported ? "UNAVAILABLE IN THIS BROWSER" : !text ? "NO BRIEFING YET"
            : playing ? "TRANSMITTING…" : state === "paused" ? "PAUSED" : "READY"}
        </div>
      </div>

      <button onClick={toggleMute} disabled={!supported}
        title={muted ? "Unmute briefing" : "Mute briefing"}
        style={{
          background: "transparent", border: "none", padding: 0, flexShrink: 0,
          color: muted ? SLATE_DIM : CYAN, cursor: supported ? "pointer" : "not-allowed",
        }}>
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}

// ── GCI ticker card ───────────────────────────────────────────────────────
function TickerCard({ label, value, sub, color, format = "money", icon: IconCmp }) {
  const shown = useTicker(value);
  const text = format === "pct" ? `${Math.round(shown)}%`
    : format === "full" ? fmtFull(shown)
      : fmtMoney(shown);
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      flex: "1 1 190px", minWidth: 0, padding: 14, borderRadius: 13,
      background: `linear-gradient(135deg,${color}0e,rgba(0,0,0,0.45))`,
      backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
      border: `1px solid ${color}33`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        {IconCmp && <IconCmp size={11} color={color} />}
        <span className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.5,
          color: SLATE_DIM, textTransform: "uppercase", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
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

// ── threat card (Panel A) ─────────────────────────────────────────────────
function ThreatCard({ threat, onSituationRoom, onTalkThrough }) {
  const tone = threat.severity === "critical" ? RED : AMBER;
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      borderRadius: 13, padding: 14, marginBottom: 11,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
      border: `1px solid ${tone}3d`, boxShadow: `inset 0 0 30px ${tone}0b`,
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
            boxShadow: `0 0 13px ${tone}44`,
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
      borderRadius: 11, border: `1px solid ${HAIRLINE}`, background: "rgba(0,0,0,0.45)",
      overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <div className="font-mono" style={{
        display: "flex", alignItems: "center", gap: 7, padding: "8px 12px",
        borderBottom: `1px solid ${HAIRLINE}`, background: "rgba(255,255,255,0.03)",
        fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.4, color: SLATE_DIM, textTransform: "uppercase",
      }}>
        <Terminal size={10} color={GREEN} />
        spark://background · {ops.length} op{ops.length !== 1 ? "s" : ""}
        <span style={{ marginLeft: "auto", color: GREEN, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, boxShadow: `0 0 7px ${GREEN}`, animation: "cmBlink 1.8s ease-in-out infinite" }} />
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
            borderBottom: "1px solid rgba(255,255,255,0.04)",
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
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
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
                    animation: "cmPulse 2.2s cubic-bezier(.2,.6,.4,1) infinite",
                  }} />
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: dot, boxShadow: `0 0 7px ${dot}` }} />
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
      backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()}
        className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          width: "min(540px,100%)", maxHeight: "88%", overflowY: "auto",
          background: "rgba(6,6,12,0.95)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          border: `1px solid ${PURPLE}55`, borderRadius: 15, padding: 20,
          boxShadow: `0 0 52px ${PURPLE}44`,
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
          background: mutating ? `${AMBER}0c` : "rgba(255,255,255,0.02)",
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
              background: plan.executable ? `linear-gradient(135deg,#7c3aed,${PURPLE})` : "rgba(255,255,255,0.05)",
              border: `1px solid ${plan.executable ? PURPLE : HAIRLINE}`,
              color: plan.executable ? "#fff" : SLATE_DIM,
              fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
              boxShadow: plan.executable && !busy ? `0 0 22px ${PURPLE}88` : "none",
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
function OmniCommand({ onSubmit, listening, onToggleMic, micSupported, transcript }) {
  const [text, setText] = useState("");
  useEffect(() => { if (transcript) setText(transcript); }, [transcript]);

  const fire = () => { if (!text.trim()) return; onSubmit(text); setText(""); };

  return (
    <div style={{ flexShrink: 0, paddingTop: 12 }}>
      <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
        border: `1px solid ${listening ? `${PURPLE}88` : HAIRLINE}`,
        boxShadow: listening ? `0 0 28px ${PURPLE}44` : "0 -6px 26px rgba(0,0,0,0.6)",
      }}>
        <button onClick={onToggleMic} disabled={!micSupported}
          title={micSupported ? (listening ? "Stop dictation" : "Speak a command") : "Speech recognition unavailable in this browser"}
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: listening ? `linear-gradient(135deg,#7c3aed,${PURPLE})` : `${PURPLE}18`,
            border: `1px solid ${PURPLE}${listening ? "" : "55"}`,
            color: listening ? "#fff" : PURPLE_LT,
            cursor: micSupported ? "pointer" : "not-allowed", opacity: micSupported ? 1 : 0.45,
            boxShadow: listening ? `0 0 20px ${PURPLE}` : `0 0 12px ${PURPLE}44`,
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

// ── demo-safe fallback synthesizer ────────────────────────────────────────
// A brand-new account has nothing to brief on. Rather than showing an empty
// terminal, this stands up a complete 8am briefing for a fictional
// high-volume luxury agent. Everything it produces is badged SIM.
// Deliberately NOT exported — a non-component export from this file breaks
// react-refresh's fast-refresh boundary and forces full page reloads in dev.
const DEMO_BRIEFING = {
  simulated: true,
  pipelineValue: 4_180_000,
  headline: "Two positions need your judgment this morning. Everything else is handled.",
  threats: [
    {
      id: "demo-t1", severity: "critical", kind: "TRANSACTION RISK", simulated: true,
      subject: "Inspection objection deadline on 104 Elm St expires in 19 hours",
      detail: "The Whitmore contract ($2.4M) hit its inspection objection deadline at 5:00 PM tomorrow. The buyer's agent submitted a $38,000 repair request Tuesday and no response has been logged. If the deadline passes without a written response, the buyer can terminate and recover earnest money.",
      action: "Get a written position from the Whitmores today — accept, counter, or reject — and send it to the buyer's agent before 5:00 PM tomorrow.",
      value: 72_000,
    },
    {
      id: "demo-t2", severity: "high", kind: "SPHERE REACTIVATION", simulated: true,
      subject: "Caroline Ashford's one-year anniversary at 88 Harbor Point is Friday",
      detail: "Caroline closed a $3.1M purchase on Friday last year and referred two clients within her first six months. She has had no contact in 94 days. One-year anniversaries are the single highest-converting reactivation window in your sphere, and it closes this week.",
      action: "Send a personal anniversary note Friday morning with a current valuation of 88 Harbor Point. Do not attach a referral ask to the first touch.",
      value: 46_500,
    },
  ],
  ops: [
    // Worded to match what utils/compliance actually does — a fair-housing
    // language review of outbound copy. It does not verify disclosures on
    // file, so no op claims it does, even in the demo.
    { id: "demo-o1", at: "08:00", simulated: true, text: "Compliance language review passed for 104 Elm St outbound copy — 4 drafts cleared" },
    { id: "demo-o2", at: "08:00", simulated: true, text: "Listing performance chron-refresh complete — 6 active listings re-scored" },
    { id: "demo-o3", at: "08:01", simulated: true, text: "Sphere scan complete — 214 contacts evaluated, 3 reactivation windows opening" },
  ],
  metrics: { atRisk: 118_500, opportunity: 46_500, probability: 71 },
  specialists: {
    coordinator: { text: "Monitoring 3 deals under contract", tone: "warn" },
    negotiate: { text: "1 open repair-credit position", tone: "warn" },
    listings: { text: "Analyzing 12 comps across 6 listings", tone: "calm" },
    coaching: { text: "Tracking a follow-up pattern", tone: "info" },
  },
};

// ── main component ────────────────────────────────────────────────────────
export default function CommandMatrix({
  loading, isDemo, voice, user, apResult, sphere, listingPerf, lastRun,
  pipelineValue = 0, specialistStatuses = {},
  onOpenSituationRoom, onTalkThrough, onOpenSpecialist, onDiscuss,
  micSupported, listening, onToggleMic, transcript,
}) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);

  const demo = isDemo || !apResult;

  // ── briefing assembly ───────────────────────────────────────────────────
  const briefing = useMemo(() => {
    if (demo) return DEMO_BRIEFING;

    const di = apResult?.deal_intelligence || {};
    const threats = [];

    (di.risks || []).forEach((r, i) => {
      threats.push({
        id: `risk-${i}`,
        severity: r.severity === "high" || r.severity === "critical" ? "critical" : "high",
        kind: "TRANSACTION RISK", simulated: false,
        // The deal name heads the card and the risk is the body. Concatenating
        // both into the subject repeated the same sentence twice on screen.
        subject: r.deal || r.risk,
        detail: r.deal ? r.risk : (r.action || r.risk),
        action: r.deal ? r.action : null, value: Number(r.value) || 0,
        _raw: r,
      });
    });

    (apResult?.relationship_alerts || []).forEach((a, i) => {
      threats.push({
        id: `alert-${i}`, severity: "high", kind: "RELATIONSHIP DECAY", simulated: false,
        subject: `${a.client} has gone quiet for ${a.days} days`,
        detail: a.reason || `No contact logged in ${a.days} days.`,
        action: a.message ? `Send: "${String(a.message).slice(0, 130)}${String(a.message).length > 130 ? "…" : ""}"` : null,
        value: 0, _raw: a,
      });
    });

    (sphere?.opportunities || []).slice(0, 1).forEach((o, i) => {
      threats.push({
        id: `sphere-${i}`, severity: "high", kind: "SPHERE REACTIVATION", simulated: false,
        subject: `${o.name} — ${o.trigger}`,
        detail: o.why_now, action: o.message ? `Open with: "${String(o.message).slice(0, 130)}…"` : null,
        value: 0, _raw: o,
      });
    });

    // Background ops describe work this system genuinely performed. Nothing
    // here is invented — each line is gated on the artifact that proves it ran.
    const ops = [];
    const at = clockOf(lastRun);
    if (apResult?.client_scores?.length) {
      ops.push({ id: "op-scores", at, text: `Client scoring complete — ${apResult.client_scores.length} contact${apResult.client_scores.length !== 1 ? "s" : ""} re-scored` });
    }
    if (apResult?.market_intelligence?.insight) {
      ops.push({ id: "op-market", at, text: "Market intelligence refresh complete — pipeline zips re-pulled" });
    }
    if (sphere) {
      ops.push({ id: "op-sphere", at, text: `Sphere scan complete — ${sphere.total_dormant ?? 0} dormant contact${(sphere.total_dormant ?? 0) !== 1 ? "s" : ""} evaluated` });
    }
    if (listingPerf?.listings?.length) {
      ops.push({ id: "op-listings", at, text: `Listing performance chron-refresh complete — ${listingPerf.listings.length} listing${listingPerf.listings.length !== 1 ? "s" : ""} re-scored` });
    }
    if (apResult?.performance_forecast) {
      ops.push({ id: "op-forecast", at, text: `GCI forecast recomputed — ${apResult.performance_forecast.momentum || "steady"} momentum` });
    }

    const atRisk = (di.risks || []).reduce((s, r) => s + (Number(r.value) || 0), 0);
    const opportunity = (di.opportunities || []).reduce((s, o) => s + (Number(o.value) || 0), 0);
    const scores = apResult?.client_scores || [];
    const probability = scores.length
      ? Math.round(scores.reduce((s, c) => {
        const p = parseInt(String(c.probability || "").replace("%", ""), 10);
        return s + (Number.isFinite(p) ? p : Number(c.score) || 0);
      }, 0) / scores.length)
      : 0;

    return {
      simulated: false,
      pipelineValue,
      headline: apResult?.mission?.headline || "No critical positions this morning.",
      threats, ops,
      metrics: { atRisk, opportunity, probability },
      specialists: specialistStatuses,
    };
  }, [demo, apResult, sphere, listingPerf, lastRun, pipelineValue, specialistStatuses]);

  const spokenText = useMemo(() => {
    const name = (voice?.name || "").split(" ")[0];
    const n = briefing.threats.length;
    return [
      `Good morning${name ? `, ${name}` : ""}. This is your eight A.M. briefing.`,
      briefing.headline,
      n ? `${n} position${n !== 1 ? "s" : ""} require your judgment.` : "Nothing requires your judgment right now.",
      ...briefing.threats.slice(0, 2).map((t) => `${t.subject}. ${t.action || ""}`),
      briefing.ops.length ? `I handled ${briefing.ops.length} operation${briefing.ops.length !== 1 ? "s" : ""} in the background.` : "",
    ].filter(Boolean).join(" ");
  }, [briefing, voice]);

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
            style={{ filter: `drop-shadow(0 0 22px ${PURPLE})`, animation: "cmBootPulse 1.5s ease-in-out infinite" }} />
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
    <div className="w-full h-full bg-[#050505]" style={{
      position: "relative", width: "100%", height: "100%", background: BG,
      display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <style>{CM_KEYFRAMES}</style>

      {/* ── scrolling body ── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,.07) transparent" }}>

        {/* ── Top telemetry banner ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            marginBottom: 12,
          }}>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div className="tracking-wider text-slate-400" style={{
                fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2.2,
                color: SLATE_DIM, textTransform: "uppercase", marginBottom: 5,
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <Radio size={10} color={CYAN} />
                Autonomous Command Matrix
                {briefing.simulated && (
                  <span style={{ color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "1px 5px", fontSize: 7 }}>
                    LIVE EXAMPLE
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: F, fontSize: 19, fontWeight: 800, lineHeight: 1.3, color: "#fff",
                textShadow: `0 0 26px ${CYAN}44`,
              }}>
                <span className="font-mono" style={{ fontFamily: MONO, color: CYAN, textShadow: `0 0 20px ${CYAN}88` }}>
                  {fmtMoney(briefing.pipelineValue)}
                </span>{" "}
                IN PIPELINE WEALTH BEING ACTIVELY PROTECTED
              </div>
            </div>

            <BriefingAudio text={spokenText} />
          </div>

          {/* ── GCI ticker cards ── */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <TickerCard label="Commission at Risk" value={m.atRisk} color={RED} icon={AlertTriangle}
              sub="Slippage exposure from stalled and deadline-bound deals" />
            <TickerCard label="Opportunity Surfaced" value={m.opportunity} color={GREEN} icon={Zap}
              sub="Sphere reactivation and dormant-lead upside found this cycle" />
            <TickerCard label="Pipeline Probability" value={m.probability} color={CYAN} format="pct" icon={LineChart}
              sub="Average close score across every scored client" />
          </div>
        </div>

        {/* ── Dual-panel briefing ── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-start" }}>

          {/* Panel A */}
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
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
                background: "rgba(0,0,0,0.5)", border: `1px solid ${HAIRLINE}`,
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

          {/* Panel B */}
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
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
        micSupported={micSupported} transcript={transcript} />

      <ConfirmModal plan={plan} busy={busy} onCancel={() => setPlan(null)} onConfirm={execute} />

      {toast && (
        <div className="backdrop-blur-2xl" style={{
          position: "absolute", bottom: 78, left: "50%", transform: "translateX(-50%)", zIndex: 210,
          background: "rgba(6,6,12,0.95)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${CYAN}88`, borderRadius: 10, padding: "10px 18px", color: "#fff",
          fontFamily: F, fontSize: 11.5, fontWeight: 700, boxShadow: `0 0 24px ${CYAN}55`,
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
