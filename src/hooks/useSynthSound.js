// src/hooks/useSynthSound.js — tiny WebAudio synth blips for UI
// micro-interactions (hex clicks, load whirs, approval ripples). No audio
// files: everything is a short oscillator envelope generated on the fly, so
// there's no binary asset to ship or license.
import { useRef, useCallback } from "react";

export function useSynthSound() {
  const ctxRef = useRef(null);

  const ctx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  const blip = useCallback(
    ({ freq = 880, duration = 0.08, type = "sine", gain = 0.05, glideTo = null } = {}) => {
      const audioCtx = ctx();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, audioCtx.currentTime + duration);
      g.gain.setValueAtTime(gain, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(g).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration + 0.02);
    },
    [ctx]
  );

  // Named presets so callers don't repeat frequency tuning everywhere.
  return {
    hexClick: () => blip({ freq: 620, glideTo: 900, duration: 0.07, type: "square", gain: 0.035 }),
    dataWhir: () => blip({ freq: 240, glideTo: 60, duration: 0.4, type: "sawtooth", gain: 0.02 }),
    approve: () => blip({ freq: 500, glideTo: 1400, duration: 0.22, type: "sine", gain: 0.045 }),
    error: () => blip({ freq: 180, glideTo: 90, duration: 0.3, type: "square", gain: 0.05 }),
    hover: () => blip({ freq: 1400, duration: 0.03, type: "sine", gain: 0.015 }),
  };
}
