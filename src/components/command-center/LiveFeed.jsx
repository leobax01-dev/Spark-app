// src/components/command-center/LiveFeed.jsx — Live Execution Feed, recolored
// per-agent (CEO=cyan, CMO=gold, CTO=green, CFO=red, CRO=violet) with a
// decoding-stream reveal. Agent is detected from keywords already present
// in each briefing entry's text (the briefing docs mention agents by name),
// falling back to the neutral text color when no agent is identifiable.
import { C, AGENT_COLOR } from "./theme";
import TypewriterText from "./TypewriterText";

function detectAgentColor(text) {
  const t = text.toUpperCase();
  for (const key of ["CMO", "CTO", "CFO", "CRO", "CEO"]) {
    if (t.includes(`${key}_AGENT`) || t.includes(`${key} AGENT`) || t.includes(`(${key})`)) {
      return AGENT_COLOR[key];
    }
  }
  return C.textMd;
}

export default function LiveFeed({ feed }) {
  return (
    <div>
      {feed.length === 0 && <div style={{ fontSize: 11, color: C.textDim, fontFamily: C.F }}>No briefings loaded yet.</div>}
      {feed.map((entry) => {
        const color = detectAgentColor(entry.text);
        return (
          <div
            key={entry.file}
            className="scc-feed-item"
            style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.panelBorder}` }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4, fontFamily: C.F, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: "none"}} />
              {entry.date}
            </div>
            <TypewriterText
              text={entry.text}
              speed={2}
              style={{
                fontSize: 11,
                color: C.textMd,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: C.F,
                display: "block",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
