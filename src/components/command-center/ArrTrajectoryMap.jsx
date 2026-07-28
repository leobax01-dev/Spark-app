// src/components/command-center/ArrTrajectoryMap.jsx — "ARR Trajectory Map":
// a radial star-chart instead of a bar/line. Center = $0, outer rim =
// the Conservative ARR target. Current ARR is rendered as a cluster of
// glowing nodes at a radius proportional to progress, with a faint orbital
// ring trail showing the path from center to rim.
//
// Honesty note: this renders whatever `arr` value the backend reports
// (currently sourced from SPARK_OS/04-Memory/Financial_Metrics.md via
// api/_lib/tasks.js's readFinancialSnapshot() — see that file). There is no
// live Stripe revenue aggregation wired up anywhere in this codebase yet;
// building that is a real backend task (a Stripe API call + aggregation
// endpoint), not something this chart component can honestly fabricate.
// When that endpoint exists, point this at it and the visualization needs
// no changes.
import { useMemo, useState } from "react";
import { C } from "./theme";
import TypewriterText from "./TypewriterText";

const SIZE = 240;
const CENTER = SIZE / 2;
const RIM_R = SIZE / 2 - 14;
const RINGS = 4;

export default function ArrTrajectoryMap({ arr = 0, target = 4_020_000 }) {
  const [hover, setHover] = useState(null);
  const progress = Math.min(1, target > 0 ? arr / target : 0);
  const nodeRadius = progress * RIM_R;

  const nodes = useMemo(() => {
    // A small cloud of nodes clustered near the current-progress radius —
    // reads as a "growing cosmic cloud" rather than a single dot, while
    // still being an honest visualization of one real number (arr).
    const count = 14;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (progress * 3.4);
      const jitterR = nodeRadius * (0.82 + ((i * 37) % 23) / 100);
      const x = CENTER + Math.cos(angle) * jitterR;
      const y = CENTER + Math.sin(angle) * jitterR;
      return { x, y, r: 1.6 + ((i * 13) % 5) * 0.5 };
    });
  }, [nodeRadius, progress]);

  const ringRadii = Array.from({ length: RINGS }, (_, i) => ((i + 1) / RINGS) * RIM_R);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onMouseLeave={() => setHover(null)}
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id="arrGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.emerald} stopOpacity="0.9" />
            <stop offset="100%" stopColor={C.emerald} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* concentric orbital rings — the "map" grid */}
        {ringRadii.map((r) => (
          <circle key={r} cx={CENTER} cy={CENTER} r={r} fill="none" stroke={C.panelBorder} strokeWidth={1} strokeDasharray="2 4" />
        ))}

        {/* rim = target */}
        <circle cx={CENTER} cy={CENTER} r={RIM_R} fill="none" stroke={C.emerald} strokeOpacity={0.4} strokeWidth={1.5} />

        {/* progress path from center to current radius */}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={CENTER}
          y2={CENTER - nodeRadius}
          stroke={C.emerald}
          strokeOpacity={0.25}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* glow halo behind the cloud */}
        <circle cx={CENTER} cy={CENTER - nodeRadius} r={26} fill="url(#arrGlow)" opacity={0.5} />

        {/* the cosmic cloud of nodes representing current ARR */}
        <g
          onMouseEnter={() => setHover({ arr, progress })}
          style={{ cursor: "pointer" }}
        >
          {nodes.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={CENTER - (CENTER - n.y)}
              r={n.r}
              fill={C.emerald}
              opacity={0.85}
            >
              <animate attributeName="opacity" values="0.4;0.95;0.4" dur={`${2.4 + (i % 5) * 0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>

        {/* center = $0 */}
        <circle cx={CENTER} cy={CENTER} r={3} fill={C.textDim} />

        {/* rim label anchor */}
        <circle cx={CENTER} cy={CENTER - RIM_R} r={2.5} fill={C.emerald} />
      </svg>

      <div style={{ marginTop: 10, textAlign: "center" }}>
        <TypewriterText
          text={`$${(arr / 1000).toFixed(0)}K / $${(target / 1_000_000).toFixed(2)}M TARGET`}
          style={{ fontSize: 11, fontFamily: C.F, color: C.emerald, letterSpacing: 1 }}
        />
        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2, letterSpacing: 1.5 }}>
          ARR TRAJECTORY · {(progress * 100).toFixed(1)}% TO RIM
        </div>
      </div>

      {hover && (
        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            color: C.textMd,
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${C.panelBorder}`,
            borderRadius: 4,
            padding: "4px 8px",
          }}
        >
          Current ARR node cluster — ${hover.arr.toLocaleString()}
        </div>
      )}
    </div>
  );
}
