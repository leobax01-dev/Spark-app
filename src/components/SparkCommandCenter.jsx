// src/components/SparkCommandCenter.jsx
//
// SPARK OS Command Center — a standalone, futuristic dark-mode HUD, voiced
// by "Alfred": a refined, unfailingly polite AI chief of staff (modeled on
// Bruce Wayne's butler) who always addresses the operator as "Mr. Bax".
//
// Center: a rotating 3D particle sphere ("Agent Core Brain") that pulses
// with voice audio amplitude, and with a manual highlight pulse the moment
// a wake word is detected. Left: system vitals (ARR, seats, white-label
// deals). Right: Command Deck quick actions that file real tasks into
// SPARK_OS/02-Tasks/Pending/ via /api/tasks. Bottom: a live feed read from
// the latest files in SPARK_OS/05-Daily-Briefings/ via the same API (the
// browser can't read the filesystem directly, so this proxies through a
// serverless function — see api/tasks.js).
//
// Voice, two paths:
//   1. Hold-to-talk: the mic button records real audio, sent to /api/voice
//      { action: "command" } for ElevenLabs speech-to-text.
//   2. Hands-Free Mode: a continuous Web Speech API
//      (webkitSpeechRecognition) listener watches for "Hey Alfred" /
//      "Alfred" / "Excuse me Alfred". Once heard, it highlights the Agent
//      Core, captures the rest of the utterance, strips the wake phrase,
//      and sends the already-transcribed text to /api/voice
//      { action: "text-command" } — no re-recording needed, since Web
//      Speech API already produced text.
// Both paths route through api/voice.js's intent classifier (CFO/CTO/CMO/
// CRO/CEO), which either files a task or reads back today's briefing, and
// returns an in-character Alfred line that's spoken via ElevenLabs
// text-to-speech — that playback's live amplitude drives the brain's pulse.
//
// Self-contained: does not import the app's shared C/UI tokens so it can
// be dropped in independently. Uses inline styles + a scoped <style> tag,
// matching the rest of this codebase's approach (no Tailwind installed).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Design tokens (local to this component) ──────────────────────────────
const C = {
  bg: "#05060a",
  panel: "rgba(255,255,255,0.03)",
  panelBorder: "rgba(255,255,255,0.08)",
  cyan: "#38f0ff",
  indigo: "#4F6BFF",
  violet: "#8b5cf6",
  emerald: "#22C55E",
  amber: "#F5A623",
  rose: "#EF4444",
  text: "rgba(255,255,255,0.95)",
  textMd: "rgba(255,255,255,0.55)",
  textDim: "rgba(255,255,255,0.30)",
  F: "'Plus Jakarta Sans','Courier New',monospace",
};

const ARR_CONSERVATIVE_TARGET = 4_020_000;

// ── 3D Agent Core Brain ────────────────────────────────────────────────────
function fibonacciSphere(count, radius) {
  const pts = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    pts[i * 3] = x * radius;
    pts[i * 3 + 1] = y * radius;
    pts[i * 3 + 2] = z * radius;
  }
  return pts;
}

function AgentCoreParticles({ pulseRef, status }) {
  const outerRef = useRef();
  const innerRef = useRef();
  const nodesRef = useRef();

  const outerGeo = useMemo(() => fibonacciSphere(900, 2.1), []);
  const innerGeo = useMemo(() => fibonacciSphere(260, 1.3), []);
  const nodeGeo = useMemo(() => fibonacciSphere(18, 2.4), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pulse = status === "online" ? pulseRef.current : 0;
    const breathing = 1 + Math.sin(t * 1.4) * 0.03 + pulse * 0.35;

    if (outerRef.current) {
      outerRef.current.rotation.y += delta * 0.06;
      outerRef.current.rotation.x = Math.sin(t * 0.15) * 0.15;
      outerRef.current.scale.setScalar(breathing);
      outerRef.current.material.size = 0.028 + pulse * 0.02;
      outerRef.current.material.opacity = 0.55 + pulse * 0.4;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * 0.12;
      innerRef.current.rotation.z += delta * 0.04;
      innerRef.current.material.opacity = 0.7 + pulse * 0.3;
    }
    if (nodesRef.current) {
      nodesRef.current.rotation.y += delta * 0.03;
      nodesRef.current.material.size = 0.09 + pulse * 0.08;
    }
  });

  return (
    <group>
      <points ref={outerRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outerGeo, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={status === "online" ? "#38f0ff" : "#3a4050"}
          size={0.028}
          sizeAttenuation
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <points ref={innerRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[innerGeo, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={status === "online" ? "#8b5cf6" : "#2a2d38"}
          size={0.05}
          sizeAttenuation
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {/* Floating "glowing nodes" — the sparse outer markers */}
      <points ref={nodesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nodeGeo, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.09}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <ambientLight intensity={0.4} />
    </group>
  );
}

function AgentCoreCanvas({ pulseRef, status }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} gl={{ antialias: true, alpha: true }}>
      <AgentCoreParticles pulseRef={pulseRef} status={status} />
    </Canvas>
  );
}

// ── Small UI atoms ─────────────────────────────────────────────────────────
function PanelLabel({ children, color = C.cyan }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
      <div style={{ width: 3, height: 12, borderRadius: 2, background: color, boxShadow: `0 0 8px ${color}` }} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color, fontFamily: C.F }}>{children}</span>
    </div>
  );
}

function VitalBar({ label, value, max, color, formatValue }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.textMd, fontFamily: C.F }}>{label}</span>
        <span style={{ fontSize: 11, color: C.text, fontFamily: C.F, fontWeight: 700 }}>
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg,${color}80,${color})`,
            boxShadow: `0 0 8px ${color}80`,
            transition: "width .6s ease",
          }}
        />
      </div>
    </div>
  );
}

function CommandButton({ label, sub, color, onClick, busy }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        width: "100%",
        textAlign: "left",
        background: C.panel,
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 10,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "all .18s ease",
      }}
      className="scc-cmd-btn"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.panelBorder)}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: C.F }}>
        {busy ? "Filing task…" : label}
      </div>
      <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.F, marginTop: 2 }}>{sub}</div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SparkCommandCenter() {
  const [status, setStatus] = useState("booting"); // booting -> online
  const [bootPct, setBootPct] = useState(0);
  const [vitals, setVitals] = useState(null);
  const [feed, setFeed] = useState([]);
  const [busyAction, setBusyAction] = useState(null);
  const [voiceState, setVoiceState] = useState("idle"); // idle | recording | thinking | speaking
  const [voiceLog, setVoiceLog] = useState(null);
  // Kept separate from voiceLog so a later failure (e.g. TTS erroring after
  // a command was already routed successfully) can't wipe out and hide the
  // good transcript/agent/task data that already rendered. Cleared the
  // moment any /api/voice call comes back with real data — i.e. the red
  // error block is bypassed as soon as we have live proof the key works.
  const [voiceError, setVoiceError] = useState(null);
  const [handsFree, setHandsFree] = useState(false);
  const [hfStatus, setHfStatus] = useState("listening"); // listening | capturing | thinking | speaking | unsupported

  const pulseRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const recognitionRef = useRef(null);
  const handsFreeRef = useRef(false);
  const hfStatusRef = useRef("listening");
  const captureBufferRef = useRef("");
  const silenceTimerRef = useRef(null);

  // Boot sequence
  useEffect(() => {
    const id = setInterval(() => {
      setBootPct((p) => {
        if (p >= 100) {
          clearInterval(id);
          setStatus("online");
          return 100;
        }
        return p + Math.random() * 18;
      });
    }, 140);
    return () => clearInterval(id);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      const data = await res.json();
      setVitals(data);
      setFeed(data.briefings || []);
    } catch {
      // Command Center degrades gracefully with no live data (e.g. local dev
      // without `vercel dev` running api/ routes) — HUD still renders.
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 30000);
    return () => clearInterval(id);
  }, [loadData]);

  async function runCommand(title, owner, body) {
    setBusyAction(title);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, owner, body, source: "command-deck" }),
      });
      const data = await res.json();
      if (res.ok) await loadData();
      return data;
    } catch (err) {
      return { error: err.message };
    } finally {
      setBusyAction(null);
    }
  }

  // ── Voice: record -> /api/voice command -> /api/voice speak -> pulse ────
  function stopPulseLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    pulseRef.current = 0;
  }

  // Manual, audio-independent pulse — used the instant a wake word is
  // detected, before any TTS audio exists to drive the analyser loop.
  function triggerWakePulse() {
    stopPulseLoop();
    const start = performance.now();
    const duration = 900;
    function tick(now) {
      const t = (now - start) / duration;
      if (t >= 1) {
        pulseRef.current = 0;
        return;
      }
      pulseRef.current = Math.sin(t * Math.PI);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function startPulseLoopFromAudioElement(audioEl) {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaElementSource(audioEl);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        pulseRef.current = Math.min(1, avg / 90);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Web Audio graph can fail silently cross-origin/blocked contexts —
      // audio still plays, the brain just won't pulse to it.
    }
  }

  async function speak(text) {
    setVoiceState("speaking");
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "speak", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "TTS failed");
      // Got real audio back — the ElevenLabs key is demonstrably working.
      // Clear any stale error (e.g. from an earlier failed call) now rather
      // than leaving a red "not configured" block up next to a voice that's
      // actually speaking.
      if (data.audioBase64) setVoiceError(null);
      const audioEl = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
      startPulseLoopFromAudioElement(audioEl);
      audioEl.onended = () => {
        stopPulseLoop();
        setVoiceState("idle");
      };
      await audioEl.play();
    } catch (err) {
      setVoiceError(err.message);
      setVoiceState("idle");
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const audioBase64 = reader.result.split(",")[1];
          setVoiceState("thinking");
          try {
            const res = await fetch("/api/voice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "command", audioBase64, mimeType: "audio/webm" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Voice command failed");
            setVoiceLog(data);
            setVoiceError(null);
            if (data.mode === "task") await loadData();
            await speak(data.spoken);
          } catch (err) {
            setVoiceError(err.message);
            setVoiceState("idle");
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceState("recording");
    } catch (err) {
      setVoiceError("Microphone access denied or unavailable: " + err.message);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  // ── Hands-Free Mode: continuous wake-word listener ("Hey Alfred") ───────
  const WAKE_RE = /(hey\s+alfred|excuse me,?\s+alfred|alfred)/i;

  function getRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (!recognitionRef.current) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e) => {
        let finalText = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + " ";
          else interimText += r[0].transcript;
        }
        const combined = (finalText + " " + interimText).trim();
        if (!combined) return;

        if (hfStatusRef.current === "listening") {
          const match = combined.match(WAKE_RE);
          if (match) {
            hfStatusRef.current = "capturing";
            setHfStatus("capturing");
            triggerWakePulse();
            captureBufferRef.current = combined.slice(match.index + match[0].length).trim();
            resetSilenceTimer();
          }
        } else if (hfStatusRef.current === "capturing") {
          captureBufferRef.current = combined.replace(WAKE_RE, "").trim();
          resetSilenceTimer();
        }
      };

      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setVoiceError("Microphone access denied for Hands-Free Mode.");
          setHandsFree(false);
          handsFreeRef.current = false;
        }
      };

      rec.onend = () => {
        // Browsers auto-stop recognition periodically; restart while Hands-Free
        // Mode is still toggled on (but not mid-dispatch — see dispatchCaptured).
        if (handsFreeRef.current && hfStatusRef.current !== "thinking" && hfStatusRef.current !== "speaking") {
          try {
            rec.start();
          } catch {
            // already started — ignore
          }
        }
      };

      recognitionRef.current = rec;
    }
    return recognitionRef.current;
  }

  function resetSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(dispatchCapturedCommand, 1400);
  }

  async function dispatchCapturedCommand() {
    const text = captureBufferRef.current.trim();
    captureBufferRef.current = "";
    if (!text) {
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      return;
    }

    hfStatusRef.current = "thinking";
    setHfStatus("thinking");
    try {
      recognitionRef.current?.stop(); // pause while Alfred thinks/speaks — avoids picking up his own voice
    } catch {
      // no-op
    }

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "text-command", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Command failed");
      setVoiceLog(data);
      setVoiceError(null);
      if (data.mode === "task") await loadData();

      hfStatusRef.current = "speaking";
      setHfStatus("speaking");
      await speak(data.spoken);
    } catch (err) {
      setVoiceError(err.message);
    } finally {
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      if (handsFreeRef.current) {
        try {
          recognitionRef.current?.start();
        } catch {
          // already started — ignore
        }
      }
    }
  }

  function toggleHandsFree() {
    const next = !handsFree;
    setHandsFree(next);
    handsFreeRef.current = next;

    if (next) {
      const rec = getRecognition();
      if (!rec) {
        setHfStatus("unsupported");
        setVoiceError("Hands-Free Mode needs a browser with Web Speech API support (e.g. Chrome).");
        setHandsFree(false);
        handsFreeRef.current = false;
        return;
      }
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      captureBufferRef.current = "";
      try {
        rec.start();
      } catch {
        // already running — ignore
      }
    } else {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    }
  }

  useEffect(
    () => () => {
      stopPulseLoop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    },
    []
  );

  const arr = vitals?.financial?.arr ?? 0;
  const soloSeats = vitals?.financial?.soloSeats ?? 0;
  const whiteLabelDeals = vitals?.financial?.whiteLabelDeals ?? 0;
  const target = vitals?.financial?.arrConservativeTarget ?? ARR_CONSERVATIVE_TARGET;

  return (
    <div style={{ height: "100vh", background: C.bg, fontFamily: C.F, color: C.text, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{`
        .scc-cmd-btn:hover { background: rgba(255,255,255,0.05) !important; }
        .scc-mic:hover { transform: scale(1.06); }
        .scc-hf-toggle:hover span:first-child { color: rgba(255,255,255,0.7) !important; }
        .scc-mic:active { transform: scale(0.96); }
        @keyframes scc-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100%)} }
        @keyframes scc-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        .scc-feed-item { animation: scc-fadein .4s ease both; }
        @keyframes scc-fadein { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* Scanline overlay for HUD feel */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.012) 3px)" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.panelBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: status === "online" ? C.emerald : C.amber, boxShadow: `0 0 10px ${status === "online" ? C.emerald : C.amber}`, animation: status !== "online" ? "scc-blink 1s infinite" : "none" }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3 }}>SPARK OS — COMMAND CENTER</span>
          <span style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, borderLeft: `1px solid ${C.panelBorder}`, paddingLeft: 10 }}>
            VOICED BY ALFRED
          </span>
        </div>
        <span style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>
          {new Date().toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 300px", gap: 0, flex: 1, minHeight: 0 }}>
        {/* LEFT — System Vitals */}
        <div style={{ borderRight: `1px solid ${C.panelBorder}`, padding: "20px 18px", overflowY: "auto" }}>
          <PanelLabel color={C.emerald}>SYSTEM VITALS</PanelLabel>
          <VitalBar
            label="ARR → Conservative Target"
            value={arr}
            max={target}
            color={C.emerald}
            formatValue={(v) => `$${(v / 1000).toFixed(0)}K / $${(target / 1_000_000).toFixed(2)}M`}
          />
          <VitalBar
            label="Active Subscriber Seats"
            value={soloSeats}
            max={Math.max(soloSeats, 20)}
            color={C.indigo}
            formatValue={(v) => `${v}`}
          />
          <VitalBar
            label="White-Label Deals"
            value={whiteLabelDeals}
            max={Math.max(whiteLabelDeals, 5)}
            color={C.violet}
            formatValue={(v) => `${v}`}
          />
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.panelBorder}` }}>
            <PanelLabel color={C.cyan}>TASK PIPELINE</PanelLabel>
            {[
              ["Pending", vitals?.counts?.pending ?? "—", C.amber],
              ["Needs Approval", vitals?.counts?.needsApproval ?? "—", C.rose],
              ["Completed", vitals?.counts?.completed ?? "—", C.emerald],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8, color: C.textMd }}>
                <span>{label}</span>
                <span style={{ color, fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — Agent Core Brain. Strict vertical flow, top to bottom:
            Agent Core Label -> 3D Orb -> Mic control. Nothing here is
            absolutely positioned against the whole column, so it can never
            overlap the Live Execution Feed below — that panel is a sibling
            of this entire grid row, not layered underneath it. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", padding: "12px 0" }}>
          {/* Globe container — capped height so the orb never grows to fill
              all available vertical space and push/overlap neighboring panels. */}
          <div style={{ position: "relative", width: "100%", height: "min(50vh, 460px)", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: 0 }}>
              <AgentCoreCanvas pulseRef={pulseRef} status={status} />
            </div>

            {/* Agent Core label — pinned to the top of the orb's own container */}
            <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: status === "online" ? C.cyan : C.textDim }}>
                AGENT CORE: {status === "online" ? "ONLINE" : "INITIALIZING"}
              </div>
              {status !== "online" && (
                <div style={{ width: 160, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", margin: "8px auto 0", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, bootPct)}%`, height: "100%", background: C.cyan, transition: "width .15s linear" }} />
                </div>
              )}
            </div>
          </div>

          {/* Mic control — flows in normal document flow below the globe
              container, centered, with clear padding above the feed panel. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0, padding: "4px 0 24px" }}>
            <button
              className="scc-mic"
              onMouseDown={!handsFree ? startRecording : undefined}
              onMouseUp={!handsFree ? stopRecording : undefined}
              onTouchStart={!handsFree ? startRecording : undefined}
              onTouchEnd={!handsFree ? stopRecording : undefined}
              disabled={handsFree || voiceState === "thinking" || voiceState === "speaking"}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: `2px solid ${voiceState === "recording" ? C.rose : C.cyan}`,
                background: voiceState === "recording" ? "rgba(239,68,68,0.15)" : "rgba(56,240,255,0.08)",
                color: voiceState === "recording" ? C.rose : C.cyan,
                fontSize: 20,
                cursor: handsFree ? "default" : "pointer",
                opacity: handsFree ? 0.35 : 1,
                transition: "transform .15s ease, opacity .2s ease",
                boxShadow: `0 0 20px ${voiceState === "recording" ? "rgba(239,68,68,0.4)" : "rgba(56,240,255,0.25)"}`,
                flexShrink: 0,
              }}
              title={handsFree ? "Disabled while Hands-Free Mode is on" : "Hold to speak to Alfred"}
            >
              🎙
            </button>
            <span style={{ fontSize: 9, letterSpacing: 1.5, color: C.textDim, textTransform: "uppercase" }}>
              {handsFree
                ? { listening: "Alfred is listening for \"Hey Alfred\"…", capturing: "Listening, Mr. Bax…", thinking: "One moment, Mr. Bax…", speaking: "Alfred is responding…", unsupported: "Hands-Free unsupported" }[hfStatus]
                : { idle: "Hold to speak to Alfred", recording: "Listening…", thinking: "Transcribing…", speaking: "Alfred is responding…" }[voiceState]}
            </span>

            {/* Hands-Free Mode toggle */}
            <button
              onClick={toggleHandsFree}
              className="scc-hf-toggle"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 2px",
              }}
              title="Toggle Hands-Free Mode — continuously listen for &quot;Hey Alfred&quot;"
            >
              <span style={{ fontSize: 9, letterSpacing: 1.2, color: handsFree ? C.emerald : C.textDim, textTransform: "uppercase", fontWeight: 700 }}>
                Hands-Free Mode
              </span>
              <span
                style={{
                  width: 30,
                  height: 16,
                  borderRadius: 10,
                  background: handsFree ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${handsFree ? C.emerald : C.panelBorder}`,
                  position: "relative",
                  transition: "background .2s ease",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    left: handsFree ? 15 : 1,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: handsFree ? C.emerald : C.textDim,
                    boxShadow: handsFree ? `0 0 6px ${C.emerald}` : "none",
                    transition: "left .18s ease",
                  }}
                />
              </span>
            </button>

            {/* Alfred's response log — always addressed to Mr. Bax */}
            {voiceLog?.transcript && (
              <div style={{ fontSize: 10, color: C.textMd, maxWidth: 280, textAlign: "center" }}>
                "{voiceLog.transcript}"
              </div>
            )}
            {voiceLog?.mode === "task" && voiceLog?.agentLabel && (
              <div style={{ fontSize: 9, color: C.violet, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                Routed to {voiceLog.agentLabel} · {voiceLog.priority} priority
              </div>
            )}
            {voiceLog?.spoken && (
              <div style={{ fontSize: 10, color: C.cyan, maxWidth: 280, textAlign: "center", fontStyle: "italic" }}>
                Alfred: "{voiceLog.spoken}"
              </div>
            )}
            {voiceError && (
              <div style={{ fontSize: 10, color: C.rose, maxWidth: 280, textAlign: "center" }}>{voiceError}</div>
            )}
          </div>
        </div>

        {/* RIGHT — Command Deck */}
        <div style={{ borderLeft: `1px solid ${C.panelBorder}`, padding: "20px 18px", overflowY: "auto" }}>
          <PanelLabel color={C.indigo}>COMMAND DECK</PanelLabel>
          <CommandButton
            label="Run Daily Briefing"
            sub="CEO Agent — compile status across all agents"
            color={C.indigo}
            busy={busyAction === "Run Daily Briefing"}
            onClick={() =>
              runCommand(
                "Run Daily Briefing",
                "CEO",
                "Compile the daily standup: shipped, pending, needs-approval, blocked, and ARR trajectory across all executive agents."
              )
            }
          />
          <CommandButton
            label="Financial Audit"
            sub="CFO Agent — reconcile MRR/ARR vs. target"
            color={C.emerald}
            busy={busyAction === "Financial Audit"}
            onClick={() =>
              runCommand(
                "Financial Audit",
                "CFO",
                "Reconcile 04-Memory/Financial_Metrics.md against current Stripe data; flag variance from the $4.02M Conservative ARR target."
              )
            }
          />
          <CommandButton
            label="Audit Multi-Tenancy RLS"
            sub="CTO Agent — verify brokerage_id isolation"
            color={C.violet}
            busy={busyAction === "Audit Multi-Tenancy RLS"}
            onClick={() =>
              runCommand(
                "Audit Multi-Tenancy RLS",
                "CTO",
                "Verify Supabase RLS policies isolate all tenant-scoped tables by brokerage_id/team_id; confirm live policy state via dashboard or supabase db pull."
              )
            }
          />
        </div>
      </div>

      {/* BOTTOM — Live Execution Feed */}
      <div style={{ borderTop: `1px solid ${C.panelBorder}`, padding: "14px 24px", flexShrink: 0 }}>
        <PanelLabel color={C.amber}>LIVE EXECUTION FEED — SPARK_OS/05-Daily-Briefings/</PanelLabel>
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
          {feed.length === 0 && (
            <div style={{ fontSize: 11, color: C.textDim }}>No briefings loaded yet.</div>
          )}
          {feed.map((entry) => (
            <div key={entry.file} className="scc-feed-item" style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.panelBorder}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.amber, marginBottom: 4 }}>{entry.date}</div>
              <div style={{ fontSize: 11, color: C.textMd, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>
                {entry.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
