// src/components/UI.jsx
// Shared design primitives — the single source of truth for cards and
// buttons across SPARK. Every panel used to define its own near-identical
// card component (APCard, MCard, CCard, TCard); this file is the one real
// implementation they now delegate to, so there's a single place to change
// the look instead of four. The visual design below is deliberately taken
// from AutopilotPanel's original APCard/APLabel — a top-edge accent glow
// and a left-tick label mark — since that pattern was already distinctive
// and working well; standardizing means everyone gets it, not that it
// gets replaced with something new and unverified.
//
// TYPOGRAPHY SCALE (reference — use these sizes, don't invent new ones):
//   Page title:      28-30px / weight 800 / letterSpacing -0.02em
//   Section header:  15-16px / weight 700
//   Card title:      13-14px / weight 700
//   Body:            12-13px / weight 400-500
//   Small / meta:    10-11px / weight 500-600
//   Micro / eyebrow:  8-9px  / weight 700 / letterSpacing 1-1.5px, uppercase
//
// BUTTON SYSTEM (strict two tiers — don't add a third):
//   Primary:   solid brand fill, for the one primary action per screen
//   Secondary: outlined/ghost, for every other action
//
// USAGE:
//   import { Card, Label, Button } from "../components/UI";
//   <Card accent={C.indigo} C={C}>...</Card>
//   <Label color={C.indigo} C={C}>SECTION TITLE</Label>
//   <Button variant="primary" C={C} onClick={...}>Save</Button>

export function Card({ children, accent, style={}, C }){
  const a = accent || C.indigo;
  return (
    <div style={{
      background: `linear-gradient(135deg,${C.surface},${C.surfaceUp})`,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "18px 16px",
      marginBottom: 12,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg,transparent,${a}50,transparent)`,
      }}/>
      {children}
    </div>
  );
}

export function Label({ children, color, C }){
  const c = color || C.indigo;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
      <div style={{
        width: 3, height: 13, borderRadius: 2,
        background: `linear-gradient(180deg,${c},${c}60)`,
        boxShadow: `0 0 7px ${c}80`,
      }}/>
      <span style={{ fontSize: 9, color: c, fontFamily: C.F, fontWeight: 700, letterSpacing: 2.2 }}>
        {children}
      </span>
    </div>
  );
}

export function Button({ children, variant="secondary", onClick, disabled, C, style={}, type="button" }){
  const isPrimary = variant==="primary";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        fontFamily: C.F, fontWeight: 700, fontSize: 13,
        padding: "10px 20px", borderRadius: 10,
        cursor: disabled ? "default" : "pointer",
        transition: "all .15s ease",
        border: isPrimary ? "none" : `1px solid ${C.borderMd}`,
        background: disabled
          ? "rgba(255,255,255,.05)"
          : isPrimary ? C.indigo : "transparent",
        color: disabled ? C.textDim : isPrimary ? "#fff" : C.text,
        boxShadow: isPrimary && !disabled ? `0 4px 14px ${C.indigo}30` : "none",
        ...style,
      }}>
      {children}
    </button>
  );
}
