// src/components/command-center/HexPanel.jsx — angular, non-rectangular
// container used for the Vitals / Pipeline / Feed shells. Clipped corners
// (not a true hexagon on non-square panels — a full hex clip-path on a wide
// rectangle just looks like a slightly-chamfered box, so this uses angled
// corner cuts, which is the actual "sci-fi panel" shape you see in games
// like this reference calls out) plus a glowing border that pulses in sync
// with the `pulse` prop (0-1, typically driven by the Agent Core's own
// activity level).
import { C } from "./theme";

const CLIP = "polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))";

export default function HexPanel({ children, accent = C.cyan, pulse = 0, style = {}, contentStyle = {}, className = "" }) {
  const glow = 0.25 + pulse * 0.55;
  return (
    <div
      className={className}
      style={{
        position: "relative",
        clipPath: CLIP,
        background: `linear-gradient(160deg, rgba(8,14,26,0.7), rgba(4,7,14,0.85))`,
        padding: 1.5,
        ...style,
      }}
    >
      {/* gradient border layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: CLIP,
          padding: 1.5,
          background: `linear-gradient(135deg, ${accent}${Math.round(glow * 255).toString(16).padStart(2, "0")}, transparent 30%, transparent 70%, ${accent}${Math.round(glow * 255).toString(16).padStart(2, "0")})`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          pointerEvents: "none",
          filter: `drop-shadow(0 0 ${6 + pulse * 10}px ${accent}55)`,
          transition: "filter .3s ease",
        }}
      />
      <div
        style={{
          position: "relative",
          clipPath: CLIP,
          background: "rgba(3,5,11,0.72)",
          height: "100%",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
