// src/components/SparkBoot.jsx — the canonical SPARK OS loading/splash
// state: a pulsing vibrant-purple lightning bolt over monospace status
// text. Shared by every Operations module (Executive Overview, Surveillance
// Radar, Intervention Engine, Performance Matrix, Commission Ledger) so a
// connection wait looks identical everywhere in the terminal.
import { Zap } from "lucide-react";

const PURPLE = "#a855f7";
const PURPLE_LT = "#c084fc";
const MONO = "'JetBrains Mono','Courier New',monospace";

export default function SparkBoot({ label = "CONNECTING TO SECURE MAINFRAME...", full = true }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-[#050505]"
      style={{
        width: "100%", height: full ? "100%" : "auto", minHeight: full ? 0 : 220,
        background: "#050505", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 18,
      }}
    >
      <style>{`@keyframes sparkBootPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.9)}}`}</style>
      <Zap
        size={46}
        className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]"
        color={PURPLE_LT}
        fill={PURPLE_LT}
        style={{ filter: `drop-shadow(0 0 22px ${PURPLE})`, animation: "sparkBootPulse 1.5s ease-in-out infinite" }}
      />
      <div
        className="font-mono tracking-wider text-slate-400"
        style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2.5, color: "rgba(148,163,184,0.65)" }}
      >
        {label}
      </div>
    </div>
  );
}
