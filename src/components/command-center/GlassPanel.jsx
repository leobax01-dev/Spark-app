// src/components/command-center/GlassPanel.jsx — deep glassmorphic panel:
// heavy backdrop blur, translucent cosmic-gradient fill, no solid 1px
// border — the glow itself (a soft box-shadow, not a hard line) defines the
// edge, and its intensity breathes with `pulse` (0-1, driven by core state).
import { C } from "./theme";

export default function GlassPanel({ children, accent = C.cyan, pulse = 0, style = {}, contentStyle = {} }) {
  const glow = 0.12 + pulse * 0.28;
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        background: `linear-gradient(160deg, rgba(20,28,50,0.35), rgba(4,7,16,0.45))`,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        boxShadow: `0 0 0 1px ${accent}18, 0 8px 40px rgba(0,0,0,0.35), 0 0 ${24 + pulse * 30}px ${accent}${Math.round(glow * 255).toString(16).padStart(2, "0")}`,
        transition: "box-shadow .4s ease",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* faint top gradient sheen — glass, not flat */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "40%",
          background: `linear-gradient(180deg, ${accent}0d, transparent)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", height: "100%", ...contentStyle }}>{children}</div>
    </div>
  );
}
