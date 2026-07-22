// src/components/UI.jsx
// Shared design primitives — the single source of truth for cards and
// buttons across SPARK. Every panel currently defines its own near-
// identical Card component (APCard, MCard, CCard, TCard) with small
// drifts in spacing/border/radius between them; this file is the
// standardized replacement going forward.
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
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${accent ? accent+"22" : C.border}`,
      borderLeft: accent ? `2px solid ${accent}` : `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "16px 18px",
      marginBottom: 12,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Label({ children, color, C }){
  return (
    <div style={{
      fontFamily: C.F, fontSize: 9, fontWeight: 700,
      letterSpacing: 1.2, color: color||C.textDim,
      marginBottom: 8, textTransform: "uppercase",
    }}>
      {children}
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
