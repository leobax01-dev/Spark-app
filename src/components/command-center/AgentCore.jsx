// src/components/command-center/AgentCore.jsx — the Agent Core: a
// shader-driven particle nebula (not just static colored points) that
// changes behavior by state:
//   idle      — slow, deep blue/cyan cosmic swirl
//   thinking  — faster, electric-purple fractal bursts
//   error     — turbulent, deep-red pulsing core
//   success   — a bright cyan flash (auto-reverts to idle after ~900ms)
//
// Built with a real custom GLSL ShaderMaterial (vertex-displaced noise
// turbulence + soft radial point sprites in the fragment shader) rather
// than swapping point colors on a static geometry — the swirl motion
// itself changes speed/turbulence per state, not just the palette.
import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uTurbulence;
  uniform float uSpeed;
  attribute float aSeed;
  varying float vSeed;
  varying float vDepth;

  // cheap hash-based pseudo-noise — no external noise texture needed
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    float t = uTime * uSpeed;

    float n1 = sin(p.x * 1.3 + t + aSeed * 6.283) * cos(p.y * 1.1 - t * 0.7);
    float n2 = cos(p.z * 1.7 - t * 0.5 + aSeed * 3.14) * sin(p.x * 0.9 + t * 0.3);
    vec3 swirl = vec3(n1, n2, n1 * n2) * uTurbulence;

    // orbital rotation around Y so the whole mass slowly turns
    float ang = t * 0.15;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    p.xz = rot * p.xz;

    vec3 displaced = p + swirl;
    vDepth = length(displaced) / 2.6;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    // Small, size-varied sprites read as a granular nebula; oversized ones
    // (this used to scale by 280.0) fully overlap under additive blending
    // and wash the whole core out into a solid white blob.
    gl_PointSize = (0.9 + hash(aSeed) * 1.3) * (16.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.0, d);
    vec3 color = mix(uColorA, uColorB, clamp(vDepth + vSeed * 0.3, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

const STATE_PRESETS = {
  idle: { colorA: "#0b2a4a", colorB: "#38f0ff", speed: 0.35, turbulence: 0.35, opacity: 0.55 },
  thinking: { colorA: "#3a0b6b", colorB: "#d16bff", speed: 1.6, turbulence: 0.85, opacity: 0.7 },
  error: { colorA: "#3a0505", colorB: "#ff2d3d", speed: 0.9, turbulence: 1.1, opacity: 0.8 },
  success: { colorA: "#083a3a", colorB: "#7dfff0", speed: 2.2, turbulence: 0.5, opacity: 0.9 },
};

function fractalCloud(count, radius) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // layered/fractal-ish distribution: blend a spherical shell with a
    // denser, noisier core so it reads as an organic mass, not a clean sphere
    const shell = Math.random() < 0.6;
    const r = shell ? radius * (0.85 + Math.random() * 0.3) : radius * Math.random() * 0.7;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    seeds[i] = Math.random();
  }
  return { positions, seeds };
}

function NebulaCore({ coreState, pulseRef }) {
  const materialRef = useRef();
  const { positions, seeds } = useMemo(() => fractalCloud(2600, 2.0), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: STATE_PRESETS.idle.speed },
      uTurbulence: { value: STATE_PRESETS.idle.turbulence },
      uColorA: { value: new THREE.Color(STATE_PRESETS.idle.colorA) },
      uColorB: { value: new THREE.Color(STATE_PRESETS.idle.colorB) },
      uOpacity: { value: STATE_PRESETS.idle.opacity },
    }),
    []
  );

  const targetRef = useRef(STATE_PRESETS.idle);
  useEffect(() => {
    targetRef.current = STATE_PRESETS[coreState] || STATE_PRESETS.idle;
  }, [coreState]);

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    const target = targetRef.current;
    const pulse = pulseRef?.current || 0;

    // ease current uniforms toward the target preset instead of snapping —
    // reads as the core "reacting", not just recoloring instantly
    uniforms.uSpeed.value += (target.speed + pulse * 1.2 - uniforms.uSpeed.value) * 0.04;
    uniforms.uTurbulence.value += (target.turbulence + pulse * 0.6 - uniforms.uTurbulence.value) * 0.05;
    uniforms.uOpacity.value += (target.opacity - uniforms.uOpacity.value) * 0.08;
    uniforms.uColorA.value.lerp(new THREE.Color(target.colorA), 0.04);
    uniforms.uColorB.value.lerp(new THREE.Color(target.colorB), 0.04);

    if (materialRef.current) materialRef.current.uniformsNeedUpdate = true;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Exported so StarSystem.jsx can render this as the Sun/Alfred Core inside
// its own shared Canvas (a solar system needs one Canvas for the whole
// scene — camera, planets, tethers, and core all together — not a separate
// nested Canvas per element).
export { NebulaCore, STATE_PRESETS };

export default function AgentCore({ coreState = "idle", pulseRef }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} gl={{ antialias: true, alpha: true }}>
      <NebulaCore coreState={coreState} pulseRef={pulseRef} />
    </Canvas>
  );
}

// Small helper hook: derive a coreState string ("idle"|"thinking"|"error"|
// "success") from the states the parent tracks, with "success"
// auto-reverting to "idle" after a short flash.
export function useCoreState({ thinking, hasError }) {
  const [flash, setFlash] = useState(null); // "success" | null
  const flashTimer = useRef(null);

  function triggerSuccessFlash() {
    setFlash("success");
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 900);
  }

  useEffect(() => () => flashTimer.current && clearTimeout(flashTimer.current), []);

  // Note: the passive "always listening for Hey Alfred" state deliberately
  // does NOT change coreState — the core stays in its calm idle swirl the
  // whole time. Only once a wake word is actually heard does a separate
  // glowing ring materialize (see StarSystem's ListeningRing), and only
  // once Alfred is generating a response does the core shift to "thinking".
  let coreState = "idle";
  if (hasError) coreState = "error";
  else if (flash) coreState = "success";
  else if (thinking) coreState = "thinking";

  return { coreState, triggerSuccessFlash };
}
