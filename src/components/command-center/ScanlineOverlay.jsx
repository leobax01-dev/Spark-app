// src/components/command-center/ScanlineOverlay.jsx — global CRT/holographic
// post-process look for the whole Command Center: scanlines, a slow-moving
// scan sweep, vignette, and a very subtle chromatic-aberration edge glow.
// Pure CSS/SVG — no postprocessing/shader library is installed in this
// project, so this approximates the effect with layered gradients + filters
// rather than a real WebGL post-process pass.
import { C } from "./theme";

export default function ScanlineOverlay({ glitch = false }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, mixBlendMode: "screen" }}>
      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(140,220,255,0.035) 3px, transparent 4px)",
        }}
      />
      {/* Slow vertical scan sweep */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "18%",
          background: "linear-gradient(180deg, transparent, rgba(140,220,255,0.05), transparent)",
          animation: "cc-scan-sweep 9s linear infinite",
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,3,10,0.55) 100%)",
        }}
      />
      {/* Glitch flash — briefly shown on approval/error events */}
      {glitch && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, ${C.cyan}22, transparent 40%, ${C.rose}18 60%, transparent)`,
            animation: "cc-glitch 0.35s steps(6) 1",
            mixBlendMode: "screen",
          }}
        />
      )}
      <style>{`
        @keyframes cc-scan-sweep { 0% { top: -20% } 100% { top: 110% } }
        @keyframes cc-glitch {
          0% { transform: translateX(0); opacity: 0.9; }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
          100% { transform: translateX(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
