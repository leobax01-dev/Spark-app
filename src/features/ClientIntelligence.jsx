// src/features/ClientIntelligence.jsx — SPARK OS Sphere Telemetry &
// Reactivation Grid.
//
// The Clients page, rebuilt as a full-bleed relationship terminal: a telemetry
// HUD, an omni-intake command bar that cannot write without an explicit
// commit, a sortable intelligence matrix, and a slide-over dossier carrying
// the sphere node map, portfolio equity, audit trail and action bridges.
//
// Standing adaptations, same rationale as every other SPARK OS terminal:
//
// 1. Styling: no Tailwind is configured in this app — requested className
//    strings are kept (free upgrade if Tailwind ever lands) and backed by
//    equivalent inline styles. Breakpoints are measured against the CONTAINER,
//    since this panel renders beside a ~250px sidebar.
//
// 2. Animation: framer-motion drives imperative value tickers only. The drawer
//    slide is a mount keyframe — a framer-motion entrance and a
//    rAF-toggled transition both failed to resolve here (see
//    TransactionIntelligence), leaving the panel stranded off-screen.
//
// 3. Derived, not stored. Tier, move probability, triggers and directives are
//    computed in features/sphere.js from the agent's own records. Move
//    probability is a MODEL and the dossier shows every factor behind it —
//    an un-interrogable score is worse than no score.
//
// 4. Consent. The intake bar never writes on parse. Everything routes through
//    a modal with [ DISCARD ] and [ COMMIT TO LEDGER ], and only the commit
//    touches storage.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "framer-motion";
import {
  Zap, X, Search, Mic, Send, Paperclip, Loader2, CheckCircle2, ChevronUp,
  ChevronDown, ArrowUpDown, Users, Wallet, Bell, Activity, Link2, Home,
  Phone, Mail, MessageSquare, Presentation, Briefcase, AlertTriangle, Clock,
  UploadCloud,
} from "lucide-react";
import { lsGet, lsSet, cloudSync } from "../utils/storage";
import MigrationCenter from "./MigrationCenter";
import {
  enrichClient, sphereTelemetry, synthesizeSphere, linkSynthConnections,
  parseBudget, TIERS,
} from "./sphere";

const BG = "#050505";
const CYAN = "#38bdf8";
const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const GREEN = "#10b981";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";
const SLATE_HEX = "#94a3b8";
const HAIRLINE = "#27272a";
const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CLIENTS_KEY = "spark_clients_v1";
const DETAIL_KEY = "spark_sphere_detail_v1";
const DEALS_KEY = "spark_pipeline_value_v1";
const TXN_DETAIL_KEY = "spark_txn_detail_v1";

// ── formatting ────────────────────────────────────────────────────────────
function fmtMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
function touchLabel(days) {
  if (days == null) return "NEVER";
  if (days === 0) return "TODAY";
  if (days === 1) return "1d";
  return `${days}d`;
}

// ── container breakpoints ─────────────────────────────────────────────────
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

// ── HUD card ──────────────────────────────────────────────────────────────
function HudCard({ label, value, sub, color, format = "money", pulse, icon: I }) {
  const shown = useTicker(value);
  const text = format === "int" ? `${Math.round(shown)}`
    : format === "days" ? (value == null ? "—" : `${Math.round(shown)}d`)
      : fmtMoney(shown);
  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      minWidth: 0, padding: 15, borderRadius: 13,
      background: `#111111`,
      backdropFilter: "none", WebkitBackdropFilter: "none",
      border: `1px solid ${color}33`,
      animation: pulse ? "none" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        {I && <I size={11} color={color} />}
        <span className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.5, color: SLATE_DIM,
          textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>[ {label} ]</span>
      </div>
      <div className="font-mono" style={{
        fontFamily: MONO, fontSize: 25, fontWeight: 800, color, textShadow: "none",
        lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{text}</div>
      <div style={{ fontFamily: F, fontSize: 9.5, color: SLATE_DIM, marginTop: 4, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

// ── probability bar ───────────────────────────────────────────────────────
function ProbBar({ value, hot }) {
  const color = value >= 80 ? PURPLE_LT : value >= 55 ? CYAN : value >= 30 ? SLATE_HEX : SLATE_DIM;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 46, height: 5, borderRadius: 3, background: "#27272a", overflow: "hidden" }}>
        <div style={{
          width: `${value}%`, height: "100%", background: color, boxShadow: "none",
          transition: "width .5s cubic-bezier(.16,1,.3,1)",
        }} />
      </div>
      <span className="font-mono" style={{
        fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color, minWidth: 30, textAlign: "right",
        animation: hot ? "none" : "none",
      }}>{value}%</span>
    </div>
  );
}

function TriggerPill({ trigger, compact }) {
  return (
    <span className="font-mono" title={trigger.detail} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: MONO, fontSize: 7, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase",
      color: trigger.color, background: `${trigger.color}16`, border: `1px solid ${trigger.color}55`,
      borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
    }}>
      {trigger.label}
      {trigger.simulated && <span style={{ color: AMBER, opacity: 0.9 }}>·SIM</span>}
      {trigger.approximate && <span style={{ color: AMBER, opacity: 0.9 }}>·APPROX</span>}
      {!compact && trigger.detail ? <span style={{ opacity: 0.7, fontWeight: 600 }}>· {trigger.detail}</span> : null}
    </span>
  );
}

// ── omni-intake ───────────────────────────────────────────────────────────
function OmniIntake({ onParsed, pad }) {
  const [text, setText] = useState("");
  const [state, setState] = useState("idle"); // idle | listening | parsing | error
  const [err, setErr] = useState("");
  const [voiceOk, setVoiceOk] = useState(false);
  const recRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setVoiceOk("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    return () => { try { recRef.current?.stop(); } catch { /* not started */ } };
  }, []);

  function toggleVoice() {
    if (state === "listening") { recRef.current?.stop(); setState("idle"); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recRef.current = rec;
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onstart = () => setState("listening");
    rec.onresult = (e) => {
      let fin = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) fin += e.results[i][0].transcript;
      if (fin) setText((p) => (p + " " + fin).trim());
    };
    rec.onend = () => setState((s) => s === "listening" ? "idle" : s);
    rec.onerror = (e) => {
      const reasons = {
        "not-allowed": "Microphone access is blocked — check your browser's site permissions.",
        "audio-capture": "No microphone found on this device.",
        network: "Voice input needs an internet connection.",
      };
      if (reasons[e.error]) { setErr(reasons[e.error]); setState("error"); } else setState("idle");
    };
    rec.start();
  }

  async function parse(imageData) {
    if (!text.trim() && !imageData) return;
    setState("parsing"); setErr("");
    try {
      const clients = lsGet(CLIENTS_KEY, []) || [];
      const roster = clients.map((c) => ({ id: c.id, name: c.name })).filter((c) => c.name);
      const content = [];
      if (imageData) content.push({ type: "image", source: { type: "base64", media_type: imageData.type, data: imageData.base64 } });
      content.push({
        type: "text", text:
          `Existing clients (match only on a strong fit — never invent a match): ${JSON.stringify(roster)}\n\n` +
          `Agent input: ${text || "(see attached image)"}\n\n` +
          `Return ONLY this JSON:\n{"matchType":"existing|new","matchedClientId":"id or null","matchedClientName":"name","confidence":"high|medium|low","summary":"one plain sentence for the agent to review before anything is saved","updates":{"name":"","phone":"","email":"","type":"buyer|seller|both or empty","stage":"prospect|active|contract|closed or empty","property":"","budget":"","timeline":"","motivation":"","noteToAdd":"short note in the agent's own words","nextAction":""}}`,
      });

      const r = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are SPARK's Relationship Manager reading a note from a real estate agent. Be conservative about matching. Only extract what is actually present — never invent details. Return ONLY valid JSON.",
          messages: [{ role: "user", content }], max_tokens: 900,
        }),
      });
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Intake parsing needs the deployed API — it isn't available in this environment.");
      const d = await r.json();
      if (!r.ok || d?.error) throw new Error(d?.error?.message || d?.error || `HTTP ${r.status}`);
      const raw = d.content?.[0]?.text || "";
      const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
      const parsed = JSON.parse(a !== -1 && b > a ? raw.slice(a, b + 1) : raw);
      setState("idle"); setText("");
      onParsed(parsed);
    } catch (e) {
      setErr(e.message || "Could not read that."); setState("error");
    }
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Images only — a screenshot or photo. PDFs aren't parsed yet."); setState("error"); return; }
    const rd = new FileReader();
    rd.onload = () => parse({ type: file.type, base64: rd.result.split(",")[1] });
    rd.onerror = () => { setErr("Could not read that file."); setState("error"); };
    rd.readAsDataURL(file);
  }

  const parsing = state === "parsing";
  const listening = state === "listening";

  return (
    <div className="w-full" style={{ width: "100%", marginBottom: 18 }}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
        className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 13,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: `1px solid ${listening ? `${RED}77` : parsing ? `${PURPLE}88` : HAIRLINE}`,
          boxShadow: "none",
          position: "relative", overflow: "hidden",
        }}>
        {parsing && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, overflow: "hidden" }}>
            <div style={{ width: "45%", height: "100%", background: `linear-gradient(90deg,transparent,${PURPLE_LT},transparent)`, animation: "ciSweep 1.1s linear infinite" }} />
          </div>
        )}

        <button onClick={toggleVoice} disabled={!voiceOk || parsing}
          title={voiceOk ? (listening ? "Stop dictation" : "Speak") : "Speech recognition unavailable in this browser"}
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: listening ? `linear-gradient(135deg,${RED},#b91c3c)` : `${PURPLE}18`,
            border: `1px solid ${listening ? RED : `${PURPLE}55`}`, color: listening ? "#fff" : PURPLE_LT,
            cursor: voiceOk && !parsing ? "pointer" : "not-allowed", opacity: voiceOk ? 1 : 0.45,
            animation: listening ? "ciGlow 1.3s ease-in-out infinite" : "none",
          }}><Mic size={15} /></button>

        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); parse(); } }}
          disabled={parsing}
          placeholder={listening ? "Listening…" : "Speak, type, or drop a screenshot of a text thread…"}
          className="ci-input"
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: MONO, fontSize: 11.5, color: "#fff" }}
        />

        {parsing && (
          <span className="font-mono tracking-wider" style={{
            fontFamily: MONO, fontSize: 8, letterSpacing: 1.4, color: PURPLE_LT, whiteSpace: "nowrap", flexShrink: 0,
            animation: "none",
          }}>EXTRACTING CLIENT INTELLIGENCE…</span>
        )}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={parsing} title="Drop or choose a screenshot"
          style={{ background: "transparent", border: "none", padding: 0, color: SLATE_DIM, cursor: parsing ? "default" : "pointer", flexShrink: 0, display: "flex" }}>
          <Paperclip size={14} />
        </button>

        <button onClick={() => parse()} disabled={parsing || !text.trim()}
          style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: text.trim() && !parsing ? `${CYAN}1e` : "transparent",
            border: `1px solid ${text.trim() && !parsing ? `${CYAN}88` : HAIRLINE}`,
            color: text.trim() && !parsing ? CYAN : SLATE_DIM, cursor: text.trim() && !parsing ? "pointer" : "default",
          }}>
          {parsing ? <Loader2 size={14} style={{ animation: "ciSpin 1s linear infinite" }} /> : <Send size={14} />}
        </button>
      </div>

      {state === "error" && (
        <div className="font-mono" style={{
          marginTop: 8, fontFamily: MONO, fontSize: 9, lineHeight: 1.6, color: AMBER,
          background: `${AMBER}0d`, border: `1px solid ${AMBER}44`, borderRadius: 8, padding: "8px 11px",
        }}>{err}</div>
      )}
      <div className="font-mono" style={{
        fontFamily: MONO, fontSize: 7.5, color: "rgba(148,163,184,0.42)", letterSpacing: 1,
        marginTop: 6, textTransform: "uppercase",
      }}>Nothing reaches your ledger without an explicit commit</div>
    </div>
  );
}

// ── commit modal ──────────────────────────────────────────────────────────
function CommitModal({ proposal, busy, onDiscard, onCommit }) {
  if (!proposal) return null;
  const u = proposal.updates || {};
  const fields = Object.entries(u).filter(([, v]) => v != null && String(v).trim() !== "");
  const isNew = proposal.matchType !== "existing";
  const lowConf = proposal.confidence === "low";

  return (
    <div onClick={onDiscard} style={{
      position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.8)",
      backdropFilter: "none", WebkitBackdropFilter: "none",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
        width: "min(560px,100%)", maxHeight: "88%", overflowY: "auto",
        background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
        border: `1px solid ${PURPLE}55`, borderRadius: 15, padding: 20, boxShadow: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
          <AlertTriangle size={15} color={PURPLE_LT} />
          <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, letterSpacing: 1.2, color: "#fff" }}>
            REVIEW BEFORE COMMIT
          </span>
          <button onClick={onDiscard} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={16} /></button>
        </div>
        <div className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 14,
        }}>Parsed intake · nothing is saved until you commit</div>

        <div style={{
          border: `1px solid ${isNew ? CYAN : PURPLE}44`, borderRadius: 11, padding: 13, marginBottom: 12,
          background: `${isNew ? CYAN : PURPLE}0c`,
        }}>
          <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1.2, color: isNew ? CYAN : PURPLE_LT, textTransform: "uppercase", marginBottom: 6 }}>
            {isNew ? "New client record" : `Updating ${proposal.matchedClientName || "an existing client"}`}
            {lowConf && <span style={{ color: AMBER }}> · low confidence</span>}
          </div>
          <div style={{ fontFamily: F, fontSize: 12, color: SLATE, lineHeight: 1.6 }}>{proposal.summary}</div>
        </div>

        {lowConf && (
          <div className="font-mono" style={{
            fontFamily: MONO, fontSize: 8.5, lineHeight: 1.6, color: AMBER, marginBottom: 12,
            background: `${AMBER}0d`, border: `1px solid ${AMBER}44`, borderRadius: 8, padding: "8px 10px",
          }}>
            ⚠ SPARK IS NOT CONFIDENT ABOUT THIS MATCH. CHECK THE NAME BEFORE COMMITTING — MERGING TWO
            DIFFERENT PEOPLE INTO ONE RECORD IS HARD TO UNPICK LATER.
          </div>
        )}

        <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
          {fields.length === 0 && (
            <div className="font-mono" style={{ padding: 16, textAlign: "center", fontFamily: MONO, fontSize: 10, color: SLATE_DIM }}>
              NOTHING EXTRACTABLE WAS FOUND.
            </div>
          )}
          {fields.map(([k, v]) => (
            <div key={k} className="font-mono" style={{
              display: "flex", gap: 12, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)",
              fontFamily: MONO, fontSize: 10.5, alignItems: "flex-start",
            }}>
              <span style={{ color: SLATE_DIM, minWidth: 96, flexShrink: 0, textTransform: "uppercase", fontSize: 8, letterSpacing: 1, paddingTop: 2 }}>{k}</span>
              <span style={{ color: "#fff", flex: 1, minWidth: 0, wordBreak: "break-word", lineHeight: 1.5 }}>{String(v)}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onDiscard} disabled={busy} style={{
            flex: "1 1 140px", padding: "14px 16px", borderRadius: 11, cursor: busy ? "default" : "pointer",
            background: "transparent", border: `1px solid ${HAIRLINE}`, color: SLATE,
            fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
          }}>[ Discard ]</button>
          <button onClick={onCommit} disabled={busy || fields.length === 0} style={{
            flex: "2 1 220px", padding: "14px 16px", borderRadius: 11,
            cursor: busy || fields.length === 0 ? "default" : "pointer",
            background: fields.length ? `#8b5cf6` : "rgba(255,255,255,0.05)",
            border: `1px solid ${fields.length ? PURPLE : HAIRLINE}`,
            color: fields.length ? "#fff" : SLATE_DIM,
            fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
            boxShadow: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1,
          }}>
            {busy ? <Loader2 size={14} style={{ animation: "ciSpin 1s linear infinite" }} /> : <Zap size={14} />}
            {busy ? "Committing…" : "[ Commit to Ledger ]"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── dossier ───────────────────────────────────────────────────────────────
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

function Dossier({ client, allClients, onClose, onOpenClient, onBridge, bridgeBusy }) {
  const d = client._detail || {};
  const connections = d.connections || [];
  const portfolio = d.portfolio || [];
  const acts = Array.isArray(client.activities) ? client.activities : [];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: client.tier.color, boxShadow: "none", flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tracking-wider text-slate-400" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase" }}>
            Client Telemetry Dossier
          </div>
          <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginTop: 3 }}>{client.name}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0, flexShrink: 0 }}><X size={17} /></button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
        <span className="font-mono" style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 800, color: client.tier.color,
          background: `${client.tier.color}16`, border: `1px solid ${client.tier.color}55`,
          borderRadius: 999, padding: "3px 9px", textTransform: "uppercase",
        }}>{client.tier.id === "—" ? "Tier —" : client.tier.label}</span>
        {client.simulated
          ? <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "2px 5px" }}>SIM</span>
          : <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: CYAN, border: `1px solid ${CYAN}55`, borderRadius: 4, padding: "2px 5px" }}>LIVE</span>}
        {client.triggers.map((t, i) => <TriggerPill key={i} trigger={t} compact />)}
      </div>

      {/* probability with its factors — the model shows its work */}
      <div style={{ border: `1px solid ${PURPLE}44`, borderRadius: 11, padding: 13, marginBottom: 20, background: `${PURPLE}0a` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
          <span className="tracking-wider" style={{ flex: 1, fontFamily: MONO, fontSize: 8, letterSpacing: 1.3, color: SLATE_DIM, textTransform: "uppercase" }}>
            AI Move Probability
          </span>
          <span className="font-mono" style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: PURPLE_LT, textShadow: "none"}}>
            {client.probability}%
          </span>
        </div>
        <div style={{ display: "grid", gap: 3 }}>
          {client.probabilityFactors.map((f, i) => (
            <div key={i} className="font-mono" style={{ display: "flex", gap: 8, fontFamily: MONO, fontSize: 9 }}>
              <span style={{ flex: 1, minWidth: 0, color: SLATE_DIM }}>{f.label}</span>
              <span style={{ color: f.delta >= 0 ? GREEN : RED, fontWeight: 700, flexShrink: 0 }}>
                {f.delta >= 0 ? "+" : ""}{f.delta}
              </span>
            </div>
          ))}
        </div>
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: AMBER, marginTop: 9, lineHeight: 1.6 }}>
          ⚠ MODELED HEURISTIC FROM YOUR OWN RECORDS — A PRIORITISATION AID, NOT A PREDICTION.
        </div>
      </div>

      {/* A · vitals + sphere node map */}
      <Section label="A · Client Vitals & Sphere Node Map" color={CYAN}>
        <div style={{ display: "grid", gap: 7, marginBottom: 12 }}>
          {[[Phone, client.phone], [Mail, client.email], [Home, client.property]].map(([I, v], i) => v ? (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <I size={11} color={SLATE_DIM} style={{ flexShrink: 0 }} />
              <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: SLATE, minWidth: 0, wordBreak: "break-word" }}>{v}</span>
            </div>
          ) : null)}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={11} color={SLATE_DIM} style={{ flexShrink: 0 }} />
            <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10.5, color: client.touch.days > 60 ? AMBER : SLATE }}>
              Last touch {touchLabel(client.touch.days)}{client.touch.at ? ` · ${fmtDate(client.touch.at)}` : ""}
            </span>
          </div>
        </div>

        <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 7 }}>
          Connected to · {connections.length}
        </div>
        {connections.length === 0 ? (
          <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, lineHeight: 1.6, padding: "10px 11px", border: `1px dashed ${HAIRLINE}`, borderRadius: 9 }}>
            NO NETWORK LINKS RECORDED. REFERRAL RELATIONSHIPS ARE NOT INFERRED — THEY ARE ONLY SHOWN WHEN LOGGED.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {connections.map((c) => {
              const target = allClients.find((x) => x.id === c.id);
              return (
                <button key={c.id} onClick={() => target && onOpenClient(target)} disabled={!target}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                    padding: "9px 11px", borderRadius: 9, cursor: target ? "pointer" : "default",
                    background: `${CYAN}0c`, border: `1px solid ${CYAN}33`,
                  }}>
                  <Link2 size={10} color={CYAN} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, flexShrink: 0 }}>{c.via}</span>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* B · portfolio & equity */}
      <Section label="B · Portfolio & Equity Tracker" color={GREEN}>
        {portfolio.length === 0 ? (
          <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, lineHeight: 1.6, padding: "10px 11px", border: `1px dashed ${HAIRLINE}`, borderRadius: 9 }}>
            NO PROPERTY ON FILE. VALUES AND RATES ARE NEVER ESTIMATED WITHOUT A RECORDED ADDRESS AND PURCHASE.
          </div>
        ) : portfolio.map((p, i) => (
          <div key={i} style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, padding: 12, marginBottom: 8, background: "#18181b" }}>
            <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{p.address}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[["Est. value", fmtMoney(p.estValue), GREEN], ["Rate", p.rate ? `${p.rate}%` : "—", CYAN], ["Purchased", fmtDate(p.purchasedAt), SLATE]].map(([l, v, c]) => (
                <div key={l} style={{ minWidth: 0 }}>
                  <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 800, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {portfolio.length > 0 && (
          <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: AMBER, lineHeight: 1.6, marginTop: 4 }}>
            ⚠ VALUES ARE ESTIMATES CARRIED ON THE RECORD, NOT LIVE AVM PULLS OR VERIFIED LOAN TERMS.
          </div>
        )}
      </Section>

      {/* C · audit trail */}
      <Section label="C · Interaction Audit Trail" color={PURPLE}>
        {acts.length === 0 && !client.notes ? (
          <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, lineHeight: 1.6, padding: "10px 11px", border: `1px dashed ${HAIRLINE}`, borderRadius: 9 }}>
            NO INTERACTIONS LOGGED YET.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 7 }}>
            {acts.slice(0, 12).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 9, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5, color: SLATE_DIM, flexShrink: 0, minWidth: 52, paddingTop: 2 }}>
                  {fmtDate(a.date || a.at || a.createdAt)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: CYAN, textTransform: "uppercase", letterSpacing: 1 }}>{a.type || "note"}</span>
                  <div style={{ fontFamily: F, fontSize: 11, color: SLATE, lineHeight: 1.55, marginTop: 2 }}>{a.summary || a.note || a.text}</div>
                </div>
              </div>
            ))}
            {client.notes && (
              <div style={{ paddingTop: 4 }}>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: SLATE_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Standing notes</div>
                <div style={{ fontFamily: F, fontSize: 11, color: SLATE, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{client.notes}</div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* D · action bridge */}
      <Section label="D · AI Action Bridge" color={PURPLE_LT} last>
        <div style={{ display: "grid", gap: 9 }}>
          {[
            ["text", MessageSquare, PURPLE, "[ Draft Trigger-Based Text ]"],
            ["deck", Presentation, CYAN, "[ Generate Portfolio Review Deck ]"],
            ["deal", Briefcase, GREEN, "[ Launch New Deal ]"],
          ].map(([id, I, color, label]) => (
            <button key={id} onClick={() => onBridge(id, client)} disabled={bridgeBusy}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, cursor: bridgeBusy ? "default" : "pointer",
                background: `${color}1c`, border: `1px solid ${color}88`, color,
                fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: bridgeBusy ? 0.6 : 1,
              }}>
              <I size={12} /> {label}
            </button>
          ))}
        </div>
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 7.5, color: SLATE_DIM, lineHeight: 1.6, marginTop: 9 }}>
          LAUNCH NEW DEAL CREATES A DRAFT IN YOUR DEALS PIPELINE PRE-FILLED FROM THIS RECORD.
        </div>
      </Section>
    </>
  );
}

// ── main ──────────────────────────────────────────────────────────────────
export default function ClientIntelligence({ user, isMobile, onNavigate, onOpenTool }) {
  const [booting, setBooting] = useState(true);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ col: "probability", dir: "desc" });
  const [proposal, setProposal] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const rootRef = useRef(null);
  const cw = useContainerWidth(rootRef);
  const wide = cw === 0 || cw >= 780;
  const mid = cw === 0 || cw >= 560;

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const load = useCallback(() => {
    const raw = lsGet(CLIENTS_KEY, []) || [];
    const detail = lsGet(DETAIL_KEY, {}) || {};
    let base = raw.map((c) => enrichClient(c, detail[c.id] || {}));
    // "Sparse" is fewer than 4 real clients — below that the grid reads empty
    // and there is nothing to demonstrate. Real records are always kept.
    if (base.length < 4) {
      const sim = linkSynthConnections(synthesizeSphere());
      base = [...base, ...sim.map((c) => enrichClient(c, c._synthDetail))];
    }
    setClients(base);
    setBooting(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── commit ──────────────────────────────────────────────────────────────
  const commit = useCallback(async () => {
    if (!proposal) return;
    setCommitting(true);
    try {
      const u = proposal.updates || {};
      const raw = lsGet(CLIENTS_KEY, []) || [];
      const now = new Date().toISOString();
      let next;
      const existing = proposal.matchType === "existing"
        ? raw.find((c) => c.id === proposal.matchedClientId)
        : null;

      if (existing) {
        next = raw.map((c) => {
          if (c.id !== existing.id) return c;
          const merged = { ...c };
          ["name", "phone", "email", "type", "stage", "property", "budget", "timeline", "motivation", "nextAction"]
            .forEach((k) => { if (u[k] && String(u[k]).trim()) merged[k] = u[k]; });
          if (u.noteToAdd) {
            merged.activities = [{ type: "note", summary: u.noteToAdd, date: now }, ...(c.activities || [])];
          }
          merged.lastContact = now;
          return merged;
        });
      } else {
        next = [...raw, {
          id: Date.now().toString(), name: u.name || proposal.matchedClientName || "Unnamed",
          phone: u.phone || "", email: u.email || "", type: u.type || "buyer",
          stage: u.stage || "prospect", property: u.property || "", budget: u.budget || "",
          timeline: u.timeline || "", motivation: u.motivation || "", notes: "",
          nextAction: u.nextAction || "", aiAction: "", lastContact: now, createdAt: now,
          activities: u.noteToAdd ? [{ type: "note", summary: u.noteToAdd, date: now }] : [],
          tags: [], tasks: [], source: "omni_intake",
        }];
      }

      lsSet(CLIENTS_KEY, next);
      const synced = user?.email ? await cloudSync(user.email, { clients: next }) : false;
      setProposal(null);
      load();
      setToast(existing
        ? `${existing.name} updated.${synced ? "" : " Saved on this device — cloud sync did not confirm."}`
        : `${u.name || proposal.matchedClientName} committed to your ledger.${synced ? "" : " Saved on this device — cloud sync did not confirm."}`);
    } catch (e) {
      setToast(`Commit failed — ${e.message || "unknown error"}. Nothing was saved.`);
    } finally { setCommitting(false); }
  }, [proposal, user, load]);

  // ── action bridges ──────────────────────────────────────────────────────
  const bridge = useCallback(async (kind, client) => {
    if (client.simulated) {
      setToast("Demo client — bridges are disabled so nothing synthesized reaches your real records.");
      return;
    }
    setBridgeBusy(true);
    try {
      if (kind === "deal") {
        const deals = lsGet(DEALS_KEY, []) || [];
        const id = Date.now().toString();
        const value = client.tier.value || 0;
        const next = [...deals, {
          id, name: client.property || `${client.name} — new deal`,
          value: String(value), probability: String(client.probability),
          stage: "offer", closeDate: "",
        }];
        lsSet(DEALS_KEY, next);
        const td = lsGet(TXN_DETAIL_KEY, {}) || {};
        lsSet(TXN_DETAIL_KEY, { ...td, [id]: { address: client.property || client.name, clientName: client.name, side: client.type === "seller" ? "seller" : "buyer" } });
        if (user?.email) await cloudSync(user.email, { pipeline: next });
        setToast(`Draft deal created for ${client.name}. Opening Deals…`);
        setTimeout(() => onNavigate?.("transactions"), 700);
      } else if (kind === "text") {
        const t = client.triggers[0];
        const prompt = t
          ? `Draft a short, warm text to ${client.name}. The trigger is: ${t.label} — ${t.detail}. Keep it personal, no hard ask.`
          : `Draft a short, warm check-in text to ${client.name}. Last contact was ${touchLabel(client.touch.days)} ago. No hard ask.`;
        onOpenTool?.("notes", prompt);
        setToast("Opening the Note Analyzer with this client loaded.");
      } else {
        onOpenTool?.("briefing");
        setToast("Portfolio review deck isn't wired to a generator yet — opening your briefing instead.");
      }
    } catch (e) {
      setToast(`Bridge failed — ${e.message || "unknown error"}.`);
    } finally { setBridgeBusy(false); }
  }, [user, onNavigate, onOpenTool]);

  // ── derived ─────────────────────────────────────────────────────────────
  const hud = useMemo(() => sphereTelemetry(clients), [clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (tierFilter !== "all" && c.tier.id !== tierFilter) return false;
      if (!q) return true;
      return `${c.name} ${c.property || ""} ${c.email || ""}`.toLowerCase().includes(q);
    });
  }, [clients, query, tierFilter]);

  const rows = useMemo(() => {
    const list = [...filtered];
    const { col, dir } = sort;
    const get = (c) => {
      if (col === "name") return (c.name || "").toLowerCase();
      if (col === "tier") return c.tier.id === "—" ? 99 : ["A", "B", "C"].indexOf(c.tier.id);
      if (col === "touch") return c.touch.days == null ? Number.MAX_SAFE_INTEGER : c.touch.days;
      if (col === "triggers") return c.triggers.length;
      return c.probability;
    };
    list.sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  const anySim = clients.some((c) => c.simulated);
  const pad = isMobile ? 24 : 32;

  if (booting) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", background: BG }}>
        <style>{CI_KEYFRAMES}</style>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Zap size={46} color={PURPLE_LT} fill={PURPLE_LT}
            style={{ filter: "none", animation: "ciBootPulse 1.5s ease-in-out infinite" }} />
          <div className="font-mono tracking-wider text-slate-400" style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: 2.2, color: SLATE_DIM,
            textAlign: "center", padding: "0 24px", lineHeight: 1.7, maxWidth: 500,
          }}>
            DECRYPTING SPHERE TOPOLOGY &amp; SCORING MOVE PROBABILITIES...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="w-full h-full flex flex-col bg-[#050505] text-white max-w-none" style={{
      position: "relative", width: "100%", maxWidth: "none", height: "100%", minHeight: 0,
      background: BG, color: "#fff", display: "flex", flexDirection: "column", boxSizing: "border-box",
    }}>
      <style>{CI_KEYFRAMES}</style>

      <div className="w-full p-6 md:p-8" style={{
        flex: 1, overflowY: "auto", minHeight: 0, width: "100%", padding: pad, boxSizing: "border-box",
        scrollbarWidth: "thin", scrollbarColor: "#27272a transparent",
      }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ minWidth: 0, marginRight: "auto" }}>
          <div className="tracking-wider text-slate-400" style={{
            fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2.2, color: SLATE_DIM,
            textTransform: "uppercase", marginBottom: 4,
          }}>Sphere Telemetry &amp; Reactivation Grid</div>
          <div style={{ fontFamily: F, fontSize: 21, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            <span className="font-mono" style={{ fontFamily: MONO, color: CYAN, textShadow: "none"}}>
              {hud.networkSize}
            </span>{" "}
            RELATIONSHIPS UNDER ACTIVE TELEMETRY
          </div>
        </div>
        <button onClick={() => setMigrating(true)} style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "10px 15px",
          borderRadius: 10, cursor: "pointer", background: `${PURPLE}1c`,
          border: `1px solid ${PURPLE}77`, color: PURPLE_LT,
          fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
        }}>
          <UploadCloud size={12} /> [ Migrate Sphere ]
        </button>
        </div>

        <OmniIntake onParsed={setProposal} pad={pad} />

        {/* HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full" style={{
          display: "grid", width: "100%", gap: 16, marginBottom: 20,
          gridTemplateColumns: wide ? "repeat(4, minmax(0,1fr))" : mid ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)",
        }}>
          <HudCard label="Total Sphere Liquidity" value={hud.liquidity} color={CYAN} icon={Wallet}
            sub={`Stated budgets across ${hud.liquidityCount} in-play client${hud.liquidityCount !== 1 ? "s" : ""}`} />
          <HudCard label="Dormant Opportunities" value={hud.dormant} color={GREEN} format="int" icon={Users}
            sub="Past clients with a surging reactivation score" />
          <HudCard label="Impending Triggers" value={hud.triggersThisWeek} color={hud.triggersThisWeek > 0 ? AMBER : SLATE_HEX}
            format="int" pulse={hud.triggersThisWeek > 0} icon={Bell}
            sub="Actionable life and market events in play" />
          <HudCard label="Network Health" value={hud.avgDays} color={PURPLE_LT} format="days" icon={Activity}
            sub={`Mean days since touch · top ${Math.min(50, hud.scoredCount)} scored`} />
        </div>

        {/* search + tier filter */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, width: "100%" }}>
          <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 38, borderRadius: 10,
            background: "#111111", border: `1px solid ${HAIRLINE}`, flex: "1 1 240px", minWidth: 0,
          }}>
            <Search size={13} color={SLATE_DIM} style={{ flexShrink: 0 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, property, email…"
              className="ci-input"
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: MONO, fontSize: 11, color: "#fff" }} />
            {query && <button onClick={() => setQuery("")} style={{ background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={12} /></button>}
          </div>
          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "#111111", border: `1px solid ${HAIRLINE}` }}>
            {[{ id: "all", label: "All", color: SLATE_HEX }, TIERS.A, TIERS.B, TIERS.C].map((t) => (
              <button key={t.id} onClick={() => setTierFilter(t.id)} className="font-mono" style={{
                padding: "6px 12px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase",
                background: tierFilter === t.id ? `${t.color}1e` : "transparent",
                border: `1px solid ${tierFilter === t.id ? `${t.color}88` : "transparent"}`,
                color: tierFilter === t.id ? t.color : SLATE_DIM,
              }}>{t.label ?? t.id}</button>
            ))}
          </div>
        </div>

        {anySim && (
          <div className="font-mono" style={{
            fontFamily: MONO, fontSize: 8, lineHeight: 1.6, color: AMBER, marginBottom: 16,
            background: `${AMBER}0d`, border: `1px solid ${AMBER}40`, borderRadius: 8, padding: "8px 11px",
          }}>
            ⚠ DEMO SPHERE ACTIVE — SIM-BADGED CLIENTS ARE SYNTHESIZED SO THE GRID IS OPERATIONAL BEFORE YOUR
            ROSTER IS FULL. THEY ARE NEVER WRITTEN TO YOUR LEDGER, AND THEIR ACTION BRIDGES ARE DISABLED.
          </div>
        )}

        {/* matrix */}
        <div className="w-full" style={{ width: "100%", border: `1px solid ${HAIRLINE}`, borderRadius: 12, overflow: "hidden", background: "#111111" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 940, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#18181b" }}>
                  {[["name", "Client Name"], ["tier", "Capital Tier"], ["probability", "AI Move Probability"],
                  ["touch", "Last Touchpoint"], ["triggers", "Active Triggers"], [null, "Next AI Directive"]].map(([col, label]) => (
                    <th key={label} onClick={() => col && setSort((s) => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }))}
                      className="tracking-wider" style={{
                        textAlign: "left", padding: "10px 14px", cursor: col ? "pointer" : "default", userSelect: "none",
                        fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.2,
                        color: sort.col === col ? CYAN : SLATE_DIM, textTransform: "uppercase",
                        borderBottom: `1px solid ${HAIRLINE}`, whiteSpace: "nowrap",
                      }}>
                      {label}
                      {col && (sort.col === col
                        ? (sort.dir === "asc" ? <ChevronUp size={9} style={{ verticalAlign: -1, marginLeft: 4 }} /> : <ChevronDown size={9} style={{ verticalAlign: -1, marginLeft: 4 }} />)
                        : <ArrowUpDown size={8} style={{ verticalAlign: -1, marginLeft: 4, opacity: 0.4 }} />)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => setSelected(c)} className="ci-row"
                    style={{ cursor: "pointer", borderBottom: "1px solid #18181b" }}>
                    <td style={{ padding: "11px 14px", maxWidth: 230 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {c.hot && (
                          <span style={{ position: "relative", width: 6, height: 6, flexShrink: 0 }}>
                            <span style={{ position: "absolute", inset: -3, borderRadius: "50%", border: `1px solid ${PURPLE}`, animation: "none" }} />
                            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: PURPLE, boxShadow: "none"}} />
                          </span>
                        )}
                        <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                        {c.simulated && <span className="font-mono" style={{ fontFamily: MONO, fontSize: 6.5, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>SIM</span>}
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span className="font-mono" style={{
                        fontFamily: MONO, fontSize: 8, fontWeight: 800, color: c.tier.color,
                        background: `${c.tier.color}16`, border: `1px solid ${c.tier.color}55`,
                        borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
                      }}>{c.tier.id}{c.tier.value != null ? ` · ${fmtMoney(c.tier.value)}` : ""}</span>
                    </td>
                    <td style={{ padding: "11px 14px", minWidth: 140 }}><ProbBar value={c.probability} hot={c.probability >= 80} /></td>
                    <td className="font-mono" style={{
                      padding: "11px 14px", fontFamily: MONO, fontSize: 10.5, whiteSpace: "nowrap",
                      color: c.touch.days == null ? RED : c.touch.days > 60 ? AMBER : SLATE,
                    }}>{touchLabel(c.touch.days)}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {c.triggers.length === 0
                          ? <span style={{ color: SLATE_DIM, fontFamily: MONO, fontSize: 9 }}>—</span>
                          : c.triggers.map((t, i) => <TriggerPill key={i} trigger={t} compact />)}
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: F, fontSize: 10.5, color: SLATE, maxWidth: 280, lineHeight: 1.45 }}>{c.directive}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="font-mono" style={{ padding: 28, textAlign: "center", fontFamily: MONO, fontSize: 10, color: SLATE_DIM }}>
                    NO CLIENTS MATCH THIS FILTER.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
            animation: "ciSlideIn .28s cubic-bezier(.16,1,.3,1) both",
            background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            borderLeft: `1px solid ${HAIRLINE}`, padding: 20, boxSizing: "border-box",
          }}>
            <Dossier client={selected} allClients={clients} onClose={() => setSelected(null)}
              onOpenClient={setSelected} onBridge={bridge} bridgeBusy={bridgeBusy} />
          </div>
        </>
      )}

      <CommitModal proposal={proposal} busy={committing} onDiscard={() => setProposal(null)} onCommit={commit} />

      {migrating && (
        <MigrationCenter user={user} onClose={() => setMigrating(false)} onImported={load} />
      )}

      {toast && (
        <div className="backdrop-blur-2xl" style={{
          position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 250,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: `1px solid ${CYAN}88`, borderRadius: 10, padding: "10px 18px", color: "#fff",
          fontFamily: F, fontSize: 11.5, fontWeight: 700, boxShadow: "none",
          maxWidth: "86%", textAlign: "center",
        }}>{toast}</div>
      )}
    </div>
  );
}

const CI_KEYFRAMES = `
@keyframes ciPulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(2.6);opacity:0}}
@keyframes ciSpin{to{transform:rotate(360deg)}}
@keyframes ciBlink{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes ciSweep{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}
@keyframes ciBootPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.9)}}
@keyframes ciSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes ciPulseBorder{0%,100%{border-color:${AMBER}55;box-shadow:0 0 0 rgba(255,176,32,0)}50%{border-color:${AMBER};box-shadow:0 0 18px rgba(255,176,32,.32)}}
@keyframes ciGlow{0%,100%{box-shadow:0 0 10px ${RED}55}50%{box-shadow:0 0 22px ${RED}99}}
.ci-input::placeholder{color:rgba(148,163,184,0.45)}
.ci-row:hover{background:#18181b}
`;
