// src/components/command-center/TypewriterText.jsx — "decoding" text reveal:
// characters scan on with a brief scrambled-glyph flicker before settling,
// like the interface is resolving a transmission rather than just printing
// a string. Re-runs whenever `text` changes (keyed by the caller if needed).
import { useEffect, useState, useRef } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソ01234567890xX#%&$@*";

export default function TypewriterText({ text = "", speed = 14, maxDurationMs = 1400, style = {}, as: Tag = "span" }) {
  const [display, setDisplay] = useState("");
  const frameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const target = String(text || "");
    // For long strings (a full briefing can run thousands of chars), reveal
    // multiple characters per tick so the whole reveal stays bounded to
    // roughly maxDurationMs instead of taking several seconds — the effect
    // should read as "decoding", not "actually typing."
    const totalTicks = Math.max(1, Math.ceil(maxDurationMs / speed));
    const step_size = Math.max(1, Math.ceil(target.length / totalTicks));
    let i = 0;

    function step() {
      if (cancelled) return;
      if (i > target.length) return;
      const revealed = target.slice(0, i);
      const scramble = target
        .slice(i, i + 3)
        .split("")
        .map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
        .join("");
      setDisplay(revealed + scramble);
      i += step_size;
      frameRef.current = setTimeout(step, speed);
    }
    step();

    return () => {
      cancelled = true;
      if (frameRef.current) clearTimeout(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <Tag style={style}>{display}</Tag>;
}
