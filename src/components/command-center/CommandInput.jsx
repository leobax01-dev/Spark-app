// src/components/command-center/CommandInput.jsx — "Direct Command Input":
// a text field under the Command Deck for typed intents ("CMO, draft a
// go-to-market announcement") or genuine questions ("how is our ARR
// looking?"), routed through Alfred's Neural Cortex (POST /api/alfred-brain)
// — the same brain the always-on wake-word listener uses — with real-time
// feedback as the system interprets and either files a task or answers.
import { useState } from "react";
import { C, agentColorFor } from "./theme";

export default function CommandInput({ onDispatched, sound, onSpeak }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState("idle"); // idle | thinking | done | error
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text || state === "thinking") return;

    setState("thinking");
    setResult(null);
    sound?.dataWhir();
    try {
      const res = await fetch("/api/alfred-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Command failed");
      setResult(data);
      setState("done");
      setValue("");
      if (data.mode === "task") onDispatched?.(data.agent);
      if (data.spoken) onSpeak?.(data.spoken);
    } catch (err) {
      setResult({ error: err.message });
      setState("error");
      sound?.error();
    }
  }

  const agentColor = result?.agent ? agentColorFor(result.agent) : C.cyan;

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid rgba(255,255,255,0.06)` }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 8, fontFamily: C.F }}>
        DIRECT COMMAND INPUT
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask Alfred, or issue a directive…"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.04)",
            border: "none",
            boxShadow: "0 0 0 1px rgba(140,200,255,0.12) inset",
            color: C.text,
            fontFamily: C.F,
            fontSize: 11,
            padding: "9px 12px",
            borderRadius: 8,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={state === "thinking" || !value.trim()}
          style={{
            background: "transparent",
            border: "none",
            boxShadow: `0 0 0 1px ${C.cyan}55 inset`,
            color: C.cyan,
            fontFamily: C.F,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1,
            padding: "0 14px",
            cursor: "pointer",
            borderRadius: 8,
            opacity: state === "thinking" ? 0.5 : 1,
          }}
        >
          {state === "thinking" ? "…" : "SEND"}
        </button>
      </form>

      {result && !result.error && (
        <div style={{ marginTop: 8, fontSize: 10, fontFamily: C.F, color: C.textMd }}>
          {result.mode === "task" && (
            <span>
              Routed to <span style={{ color: agentColor, fontWeight: 700 }}>{result.agentLabel}</span> · {result.priority} priority
            </span>
          )}
          {result.mode === "conversation" && <span style={{ color: C.cyan, fontStyle: "italic" }}>Alfred: "{result.spoken}"</span>}
          {result.mode === "briefing" && <span>Briefing read back aloud.</span>}
        </div>
      )}
      {result?.error && <div style={{ marginTop: 8, fontSize: 10, fontFamily: C.F, color: C.rose }}>{result.error}</div>}
    </div>
  );
}
