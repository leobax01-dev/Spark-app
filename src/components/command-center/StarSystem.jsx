// src/components/command-center/StarSystem.jsx — the Cosmic Star System.
// One shared Canvas: Alfred is the central Sun/core (reusing the nebula
// shader from AgentCore.jsx), orbited by four C-Suite planets (CEO/CMO/CTO/
// CFO) connected to the core by glowing tether lines. Clicking a planet
// reports up to the parent (camera focus + opens the Holographic Dossier).
// Completed/approved tasks for an agent send a physical pulse of light down
// that planet's tether back to the core (see `pulseTriggers` prop).
import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { NebulaCore } from "./AgentCore";
import { AGENT_COLOR } from "./theme";

const PLANETS = [
  { key: "CEO", radius: 2.6, speed: 0.22, size: 0.16, phase: 0 },
  { key: "CMO", radius: 3.35, speed: 0.17, size: 0.14, phase: 1.6 },
  { key: "CTO", radius: 4.1, speed: 0.13, size: 0.15, phase: 3.4 },
  { key: "CFO", radius: 4.85, speed: 0.1, size: 0.13, phase: 5.0 },
];

function OrbitRing({ radius, color }) {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return pts;
  }, [radius]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.16} />
    </line>
  );
}

function Tether({ getPlanetPos, color, pulseRef }) {
  const lineRef = useRef();
  const positions = useMemo(() => new Float32Array([0, 0, 0, 0, 0, 0]), []);
  const pulseMeshRef = useRef();

  useFrame(() => {
    const p = getPlanetPos();
    positions[3] = p.x;
    positions[4] = p.y;
    positions[5] = p.z;
    if (lineRef.current) {
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
    // Pulse: a bright bead traveling from planet (t=1) to core (t=0)
    const pulse = pulseRef.current;
    if (pulseMeshRef.current) {
      if (pulse.active) {
        pulse.t += 0.028;
        if (pulse.t >= 1) {
          pulse.active = false;
          pulseMeshRef.current.visible = false;
        } else {
          pulseMeshRef.current.visible = true;
          const t = 1 - pulse.t; // travels planet -> core
          pulseMeshRef.current.position.set(p.x * t, p.y * t, p.z * t);
        }
      } else {
        pulseMeshRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.35} />
      </line>
      <mesh ref={pulseMeshRef} visible={false}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Planet({ def, focused, dimmed, onSelect, positionRef }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const angleRef = useRef(def.phase);

  useFrame((state, delta) => {
    angleRef.current += def.speed * delta;
    const x = Math.cos(angleRef.current) * def.radius;
    const z = Math.sin(angleRef.current) * def.radius;
    const y = Math.sin(state.clock.elapsedTime * 0.4 + def.phase) * 0.15;
    // positionRef is the Vector3 itself (see StarSystem's positionRefs.current[i]),
    // not a {current: Vector3} wrapper — call .set() directly on it.
    positionRef.set(x, y, z);
    if (meshRef.current) meshRef.current.position.set(x, y, z);
    if (glowRef.current) {
      glowRef.current.position.set(x, y, z);
      const s = focused ? 1.6 : 1;
      glowRef.current.scale.setScalar(s * (1 + Math.sin(state.clock.elapsedTime * 2) * 0.06));
    }
  });

  const color = AGENT_COLOR[def.key] || "#8CA0FF";

  return (
    <group>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(def.key);
        }}
        onPointerOver={(e) => e.object.scale.setScalar(1.25)}
        onPointerOut={(e) => e.object.scale.setScalar(1)}
      >
        <sphereGeometry args={[def.size, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.35 : 1} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[def.size * 2.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.06 : 0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ListeningRing({ active }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(0);
  useFrame((state, delta) => {
    setOpacity((o) => o + ((active ? 0.75 : 0) - o) * 0.12);
    if (ref.current) {
      ref.current.rotation.z += delta * 0.6;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
      ref.current.scale.setScalar(pulse);
    }
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.5, 0.015, 8, 96]} />
      <meshBasicMaterial color="#38f0ff" transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function CameraRig({ focusedPos, active }) {
  const { camera } = useThree();
  const defaultPos = useMemo(() => new THREE.Vector3(0, 2.2, 7.5), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (active && focusedPos.current) {
      target.set(focusedPos.current.x * 0.6, focusedPos.current.y + 0.6, focusedPos.current.z * 0.6 + 2.2);
    } else {
      target.copy(defaultPos);
    }
    camera.position.lerp(target, 0.045);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function StarSystem({ coreState = "idle", pulseRef, listening, focusedAgent, onSelectPlanet, pulseTriggers }) {
  const positionRefs = useRef(PLANETS.map(() => new THREE.Vector3()));
  const pulseStates = useRef(PLANETS.map(() => ({ active: false, t: 0 })));

  // Fire a pulse animation down an agent's tether when the parent signals
  // a task event for that agent (pulseTriggers is a {CEO: n, CMO: n, ...}
  // counter — any increment fires a new pulse for that key).
  const prevTriggers = useRef({});
  useEffect(() => {
    if (!pulseTriggers) return;
    PLANETS.forEach((def, i) => {
      const prev = prevTriggers.current[def.key] || 0;
      const next = pulseTriggers[def.key] || 0;
      if (next > prev) {
        pulseStates.current[i] = { active: true, t: 0 };
      }
    });
    prevTriggers.current = { ...pulseTriggers };
  }, [pulseTriggers]);

  const focusedIndex = PLANETS.findIndex((p) => p.key === focusedAgent);
  const focusedPosRef = focusedIndex >= 0 ? positionRefs.current[focusedIndex] : null;

  return (
    <Canvas camera={{ position: [0, 2.2, 7.5], fov: 48 }} gl={{ antialias: true, alpha: true }}>
      <CameraRig focusedPos={{ current: focusedPosRef }} active={focusedIndex >= 0} />
      <ambientLight intensity={0.3} />

      {/* Alfred — the central Sun/core */}
      <NebulaCore coreState={coreState} pulseRef={pulseRef} />
      <ListeningRing active={listening} />

      {PLANETS.map((def, i) => (
        <group key={def.key}>
          <OrbitRing radius={def.radius} color={AGENT_COLOR[def.key]} />
          <Tether getPlanetPos={() => positionRefs.current[i]} color={AGENT_COLOR[def.key]} pulseRef={{ current: pulseStates.current[i] }} />
          <Planet
            def={def}
            focused={focusedAgent === def.key}
            dimmed={Boolean(focusedAgent) && focusedAgent !== def.key}
            onSelect={onSelectPlanet}
            positionRef={positionRefs.current[i]}
          />
        </group>
      ))}
    </Canvas>
  );
}

export { PLANETS };
