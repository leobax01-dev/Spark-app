// src/components/UI.jsx
// Shared design primitives — the single source of truth for cards and
// buttons across SPARK. Every panel used to define its own near-identical
// card/button components (APCard/MCard/CCard/TCard, CBtn/MBtn/TBtn, and
// five near-identical copy buttons); this file is the one real
// implementation they now delegate to, so there's a single place to
// change the look instead of several. The card/label design below is
// deliberately taken from AutopilotPanel's original APCard/APLabel — a
// top-edge accent glow and a left-tick label mark — since that pattern
// was already distinctive and working well; standardizing means
// everyone gets it, not that it gets replaced with something new and
// unverified. Same logic for the primary button's gradient+loading
// pattern, taken from ClientPanel's original CBtn.
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
//   Primary:   solid brand gradient fill, for the one primary action
//   Secondary: outlined/ghost, for every other action
//
// USAGE:
//   import { Card, Label, Button, CopyButton } from "../components/UI";
//   <Card accent={C.indigo} C={C}>...</Card>
//   <Label color={C.indigo} C={C}>SECTION TITLE</Label>
//   <Button variant="primary" C={C} onClick={...}>Save</Button>
//   <CopyButton text={someText} C={C}/>

import { useState } from "react";

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

export function Button({ children, variant="secondary", onClick, disabled, loading, color, full=true, small=false, C, style={}, type="button" }){
  const isPrimary = variant==="primary";
  const isOff = disabled || loading;
  const primaryColor = color || C.indigo;
  return (
    <button type={type} onClick={onClick} disabled={isOff}
      style={{
        fontFamily: C.F, fontWeight: isPrimary?800:700, fontSize: small?11:13,
        letterSpacing: isPrimary?.3:0,
        width: isPrimary ? (small?"auto":(full?"100%":"auto")) : "auto",
        padding: small ? "7px 14px" : "13px 0",
        borderRadius: 10,
        cursor: isOff ? "default" : "pointer",
        transition: "all .2s ease",
        border: isPrimary ? "none" : `1px solid ${C.borderMd}`,
        background: isOff
          ? "rgba(255,255,255,.06)"
          : isPrimary ? `linear-gradient(135deg,${primaryColor},${primaryColor}cc)` : "transparent",
        color: isOff ? C.textDim : isPrimary ? "#fff" : C.text,
        boxShadow: isPrimary && !isOff ? `0 4px 16px ${primaryColor}28` : "none",
        opacity: loading ? .6 : 1,
        ...style,
      }}>
      {loading ? "Generating..." : children}
    </button>
  );
}

export function CopyButton({ text, C, stopPropagation=false, shortLabel=false }){
  const [ok, setOk] = useState(false);
  function handleClick(e){
    if(stopPropagation) e.stopPropagation();
    navigator.clipboard.writeText(text||"").then(()=>{
      setOk(true);
      setTimeout(()=>setOk(false), 2000);
    });
  }
  return (
    <button onClick={handleClick}
      style={{
        background: "transparent", border: `1px solid ${C.border}`,
        color: ok ? C.emerald : C.textDim,
        borderRadius: 6, padding: "3px 9px", cursor: "pointer",
        fontSize: 9, fontFamily: C.F, fontWeight: 700,
        letterSpacing: 1, transition: "all .14s ease", flexShrink: 0,
      }}>
      {ok ? (shortLabel ? "✓" : "✓ COPIED") : "COPY"}
    </button>
  );
}
