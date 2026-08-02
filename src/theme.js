// src/theme.js — SPARK OS "Matte Void" design system.
//
// Single source of truth for every colour, surface and type token in the app.
//
// THE ANTI-GLOW RULE
// ------------------
// This palette is deliberately matte. The UI communicates institutional trust
// through structure — borders, alignment, typographic hierarchy — not through
// light. Concretely, that means:
//
//   · No coloured box-shadows or text-shadows. Panels are separated by
//     hairline borders, never by glow.
//   · No backdrop-blur on structural panels. Surfaces are solid and opaque.
//   · No saturated multi-stop gradients as backgrounds or borders.
//   · No pulsing animation EXCEPT on a critical, time-sensitive alert (an
//     uncontacted lead under five minutes old, a contingency inside 48 hours).
//     Decoration that pulses trains people to ignore the thing that matters.
//
// Tailwind is not installed in this project, so these tokens are consumed two
// ways: imported directly for inline styles (how the components are built),
// and mirrored as CSS custom properties in index.css for stylesheet use.

// ── surfaces ──────────────────────────────────────────────────────────────
export const VOID = "#050505";        // app background — flat, absolute
export const PANEL = "#111111";       // card / container — solid, zero alpha
export const PANEL_HI = "#18181b";    // raised: pill badges, table hover, inputs
export const PANEL_LO = "#0a0a0a";    // recessed: table headers, sidebars
export const BORDER = "#27272a";      // hairline zinc — the primary separator
export const BORDER_HI = "#3f3f46";   // emphasised border, badge outlines

// ── accents ───────────────────────────────────────────────────────────────
export const PRIMARY = "#8b5cf6";     // matte violet — NOT neon
export const PRIMARY_DIM = "#7c3aed";
export const PRIMARY_TEXT = "#a78bfa";
export const SECONDARY = "#38bdf8";   // icy blue
export const SECONDARY_TEXT = "#7dd3fc";
export const POSITIVE = "#10b981";    // financial green
export const WARNING = "#f59e0b";     // amber
export const NEGATIVE = "#ef4444";    // red

// ── type ──────────────────────────────────────────────────────────────────
export const TEXT = "#f4f4f5";        // primary / data values (slate-100)
export const TEXT_BODY = "#a1a1aa";   // body copy (zinc-400)
export const TEXT_DIM = "#71717a";    // labels, captions (zinc-500)
export const TEXT_FAINT = "#52525b";  // disabled, placeholder

export const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";
export const MONO = "'JetBrains Mono','SF Mono','Courier New',monospace";

// ── chart tokens ──────────────────────────────────────────────────────────
export const GRID = BORDER;
export const GRID_DASH = "3 3";
export const AXIS_TICK = { fill: TEXT_DIM, fontSize: 10, fontFamily: MONO };

// Recharts wants a real <defs> gradient id. Register once per chart via
// <defs>{areaGradient("gPrimary", PRIMARY)}</defs> and reference fill="url(#gPrimary)".
export function areaGradientStops(color) {
  return [
    { offset: "0%", stopColor: color, stopOpacity: 0.4 },
    { offset: "100%", stopColor: color, stopOpacity: 0 },
  ];
}

// ── composable style fragments ────────────────────────────────────────────
// Used everywhere instead of per-component literals so a token change here
// propagates without touching 27 files again.

/** Solid panel: flat surface, hairline border, no shadow, no blur. */
export const panel = (extra = {}) => ({
  background: PANEL,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  boxShadow: "none",
  ...extra,
});

/** Structural label: 10px uppercase, wide tracking, dim. */
export const label = (extra = {}) => ({
  fontFamily: FONT,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: TEXT_DIM,
  ...extra,
});

/** Every metric, currency figure, percentage, timestamp and ledger entry. */
export const mono = (size = 12, extra = {}) => ({
  fontFamily: MONO,
  fontSize: size,
  color: TEXT,
  fontVariantNumeric: "tabular-nums",
  ...extra,
});

/** Flat minimalist status pill. No glow, no saturated fill. */
export const pill = (color = TEXT_BODY, extra = {}) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: PANEL_HI,
  border: `1px solid ${BORDER_HI}`,
  color,
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 500,
  padding: "3px 8px",
  borderRadius: 6,
  whiteSpace: "nowrap",
  ...extra,
});

/** Table header cell. */
export const th = (align = "left", extra = {}) => ({
  textAlign: align,
  padding: "0 14px 12px",
  fontFamily: FONT,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: TEXT_DIM,
  borderBottom: `1px solid ${BORDER}`,
  whiteSpace: "nowrap",
  ...extra,
});

/** Primary action. Flat violet fill, no glow. */
export const btnPrimary = (extra = {}) => ({
  background: PRIMARY,
  border: `1px solid ${PRIMARY}`,
  color: "#fff",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  padding: "10px 16px",
  borderRadius: 6,
  cursor: "pointer",
  boxShadow: "none",
  ...extra,
});

/** Secondary / ghost action. */
export const btnGhost = (color = TEXT_BODY, extra = {}) => ({
  background: "transparent",
  border: `1px solid ${BORDER_HI}`,
  color,
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  padding: "10px 16px",
  borderRadius: 6,
  cursor: "pointer",
  boxShadow: "none",
  ...extra,
});

/** Tinted surface for an accent region — flat alpha, never a gradient. */
export const tint = (color, alpha = "14") => `${color}${alpha}`;

// Legacy neon → matte mapping. Kept exported so any straggler importing an old
// constant still lands on a palette colour rather than a neon one.
// Legacy neon values are no longer present in the codebase — the migration
// rewrote them in place. This map is kept as documentation of what moved where.
export const LEGACY_MAP_APPLIED = {
  "neon purple #a855f7": PRIMARY,
  "neon cyan #22d3ee": SECONDARY,
  "neon green #22c55e": POSITIVE,
  "neon amber #ffb020": WARNING,
  "neon red #ff3b5c": NEGATIVE,
  "indigo #4F6BFF": PRIMARY,
};
