// src/components/command-center/CommandInput.jsx — "Direct Command Input":
// a text field under the Command Deck for typed intents ("CMO, draft a
// go-to-market announcement"), routed through the same backend intent
// classifier voice commands use (POST /api/voice {action:"text-command"}),
// with real-time feedback as the system interprets and files the task.
import { useState } from "react";
import { C, agentColorFor } from "./theme";

export default function CommandInput({ onDispatched, sound }) {
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
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "text-command", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Command failed");
      setResult(data);
      setState("done");
      setValue("");
      if (data.mode === "task") onDispatched?.();
    } catch (err) {
      setResult({ error: err.message });
      setState("error");
      sound?.error();
    }
  }

  const agentColor = result?.agent ? agentColorFor(result.agent) : C.cyan;

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.panelBorder}` }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 8, fontFamily: C.F }}>
        DIRECT COMMAND INPUT
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. CMO, draft a GTM announcement"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.panelBorder}`,
            color: C.text,
            fontFamily: C.F,
            fontSize: 11,
            padding: "8px 10px",
            borderRadius: 2,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={state === "thinking" || !value.trim()}
          style={{
            background: "transparent",
            border: `1px solid ${C.cyan}`,
            color: C.cyan,
            fontFamily: C.F,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1,
            padding: "0 14px",
            cursor: "pointer",
            borderRadius: 2,
            opacity: state === "thinking" ? 0.5 : 1,
          }}
        >
          {state === "thinking" ? "…" : "SEND"}
        </button>
      </form>

      {result && !result.error && (
        <div style={{ marginTop: 8, fontSize: 10, fontFamily: C.F, color: C.textMd }}>
          {result.mode === "task" ? (
            <span>
              Routed to <span style={{ color: agentColor, fontWeight: 700 }}>{result.agentLabel}</span> ·{" "}
              {result.priority} priority
            </span>
          ) : (
            <span>Briefing read back — see Agent Core response.</span>
          )}
        </div>
      )}
      {result?.error && <div style={{ marginTop: 8, fontSize: 10, fontFamily: C.F, color: C.rose }}>{result.error}</div>}
    </div>
  );
}
