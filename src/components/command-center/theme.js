// src/components/command-center/theme.js — shared "Elite Military OS / alien
// tech" design tokens for the Command Center module tree. One place to tune
// the palette instead of duplicating hex codes across a dozen files.
export const C = {
  bg: "#03040a",
  bgDeep: "#010103",
  panel: "rgba(180,220,255,0.035)",
  panelHi: "rgba(180,220,255,0.07)",
  panelBorder: "rgba(140,200,255,0.14)",
  glass: "rgba(6,10,20,0.55)",

  cyan: "#38f0ff",
  indigo: "#4F6BFF",
  violet: "#b26bff",
  emerald: "#22C55E",
  amber: "#F5C542",
  gold: "#e8c15a",
  rose: "#ff4d5e",
  green: "#3ddc84",

  text: "rgba(225,240,255,0.96)",
  textMd: "rgba(200,220,245,0.6)",
  textDim: "rgba(180,210,240,0.32)",

  F: "'JetBrains Mono','Fira Code','Courier New',monospace",
};

// Per-agent identity colors — used by the Live Execution Feed, task glyphs,
// and the Command Deck. CEO = cyan, CMO = gold, CTO = green, CFO = red, per
// spec; CRO gets violet to round out the roster.
export const AGENT_COLOR = {
  CEO: C.cyan,
  CMO: C.gold,
  CTO: C.green,
  CFO: C.rose,
  CRO: C.violet,
};

export function agentColorFor(ownerOrSlug) {
  const key = String(ownerOrSlug || "").toUpperCase().replace(/_AGENT$/, "").slice(0, 3);
  return AGENT_COLOR[key] || C.textMd;
}

export const PRIORITY_COLOR = {
  High: C.rose,
  Medium: C.amber,
  Low: C.textDim,
};
