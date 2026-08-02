// src/components/command-center/PipelineHex.jsx — a clickable hex module
// for one pipeline category (Pending / Needs Approval / Completed).
import { C } from "./theme";

const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

export default function PipelineHex({ label, count, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className="cc-pipeline-hex"
      style={{
        clipPath: HEX_CLIP,
        border: "none",
        background: active ? `${color}22` : "#18181b",
        padding: "14px 10px",
        cursor: "pointer",
        fontFamily: C.F,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        transition: "background .18s ease, transform .15s ease",
        boxShadow: "none",
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 800, color, textShadow: "none"}}>{count}</span>
      <span style={{ fontSize: 8, letterSpacing: 1.2, color: C.textMd, textTransform: "uppercase" }}>{label}</span>
    </button>
  );
}
