import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  Group,
  MathUtils,
  Mesh,
  Points,
  Vector3,
} from "three";
import type { MutableRefObject } from "react";
export interface JourneyProps {
  progress: MutableRefObject<{ value: number }>;
  metric: number;
  compact: boolean;
  onReady: () => void;
  onLost: () => void;
}
function World({
  progress,
  metric,
  compact,
}: Pick<JourneyProps, "progress" | "metric" | "compact">) {
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (event: PointerEvent) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = 1 - (event.clientY / window.innerHeight) * 2;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  const dial = useRef<Group>(null);
  const particles = useRef<Points>(null);
  const bars = useRef<Group>(null);
  const smoothed = useRef(0);
  const data = useMemo(() => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = compact ? 90 : 180;
    const scattered = new Float32Array(count * 3),
      aligned = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      scattered.set(
        [(rand() - 0.5) * 17, (rand() - 0.5) * 11, -rand() * 29],
        i * 3,
      );
      aligned.set(
        [Math.sin(i * 0.83) * 0.38, Math.cos(i * 0.83) * 0.38, (-i / count) * 29],
        i * 3,
      );
    }
    return { scattered, aligned, positions: scattered.slice() };
  }, [compact]);
  const path = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(7, 4, 14),
        new Vector3(2.4, 1.1, 3),
        new Vector3(-1.6, 0.8, -6),
        new Vector3(5.7, 3.2, -12),
        new Vector3(3.8, 2.5, -20),
      ]),
    [],
  );
  const target = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0, 0, -7),
        new Vector3(0, 0, -14),
        new Vector3(0, 0, -18),
        new Vector3(0, 0, -27),
      ]),
    [],
  );
  const position = useMemo(() => new Vector3(), []),
    look = useMemo(() => new Vector3(), []);
  const gold = useMemo(() => new Color("#d4af37"), []),
    slate = useMemo(() => new Color("#637488"), []);
  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    smoothed.current = MathUtils.damp(
      smoothed.current,
      progress.current.value,
      4,
      dt,
    );
    const t = smoothed.current;
    path.getPointAt(t, position);
    position.x += mouse.current.x * 0.18;
    position.y += mouse.current.y * 0.12;
    camera.position.copy(position);
    target.getPointAt(t, look);
    camera.lookAt(look);
    if (dial.current) dial.current.rotation.z = clock.elapsedTime * 0.045;
    if (particles.current) {
      const attr = particles.current.geometry.getAttribute(
        "position",
      ) as BufferAttribute;
      const focus = MathUtils.smoothstep(t, 0.05, 0.47);
      for (let i = 0; i < data.positions.length / 3; i++) {
        for (let axis = 0; axis < 3; axis++) {
          const index = i * 3 + axis;
          attr.array[index] =
            MathUtils.lerp(data.scattered[index], data.aligned[index], focus) +
            (axis === 1
              ? Math.sin(clock.elapsedTime * 0.32 + i) * 0.06 * (1 - focus)
              : 0);
        }
      }
      attr.needsUpdate = true;
    }
    if (bars.current)
      bars.current.children.forEach((child, i) => {
        const mesh = child as Mesh;
        mesh.scale.y = MathUtils.damp(
          mesh.scale.y,
          i === metric ? 1.14 : 1,
          5,
          dt,
        );
      });
  });
  return (
    <>
      <color attach="background" args={["#0b0d10"]} />
      <fog attach="fog" args={["#0b0d10", 13, 44]} />
      <ambientLight intensity={0.8} />
      <Environment resolution={64} frames={1}>
        <Lightformer
          intensity={3}
          color="#fff1cb"
          position={[3, 5, 5]}
          scale={[8, 4, 1]}
          rotation={[0, -0.6, 0]}
        />
        <Lightformer
          intensity={2}
          color="#38bdf8"
          position={[-4, 1, -5]}
          scale={[4, 6, 1]}
          rotation={[0, Math.PI / 2, 0]}
        />
      </Environment>
      <directionalLight position={[4, 7, 6]} intensity={3} color="#f5e6b6" />
      <pointLight
        position={[-4, 3, -12]}
        intensity={35}
        color="#38bdf8"
        distance={20}
      />
      <pointLight
        position={[2, 3, -21]}
        intensity={40}
        color="#d4af37"
        distance={18}
      />
      <points ref={particles}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[data.positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          color="#9ba9b8"
          transparent
          opacity={0.72}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <group ref={dial} position={[0, 0, 0]} rotation={[0.18, 0.2, 0]}>
        <mesh>
          <torusGeometry args={[2.35, 0.055, 12, 100]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.8}
            roughness={0.26}
          />
        </mesh>
        <mesh rotation={[0.5, 0.2, 0.25]}>
          <torusGeometry args={[1.85, 0.18, 12, 80]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.85}
            roughness={0.23}
          />
        </mesh>
        <mesh rotation={[-0.5, 0.7, 0]}>
          <torusGeometry args={[1.4, 0.028, 8, 80]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[i % 3 === 0 ? 0.2 : 0.08, 0.025, 0.04]} />
              <meshBasicMaterial color={i % 3 === 0 ? "#d4af37" : "#536071"} />
            </mesh>
          );
        })}
        <mesh rotation={[0.5, 0.5, 0.25]}>
          <octahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial
            color="#9fa89e"
            metalness={1}
            roughness={0.18}
          />
        </mesh>
      </group>
      {[-5, -9, -13].map((z, i) => (
        <group key={z} position={[0, 0, z]} rotation={[0, i * 0.15, 0]}>
          <mesh>
            <torusGeometry args={[2.1 - i * 0.15, 0.035, 10, 80]} />
            <meshBasicMaterial color={i === 1 ? "#38bdf8" : "#d4af37"} />
          </mesh>
          <mesh>
            <cylinderGeometry
              args={[1.95 - i * 0.15, 1.95 - i * 0.15, 0.06, 48, 1, true]}
            />
            <meshStandardMaterial
              color="#88bada"
              transparent
              opacity={0.16}
              metalness={0.7}
              roughness={0.12}
              side={2}
            />
          </mesh>
          <mesh>
            <circleGeometry args={[1.9 - i * 0.15, 48]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.025}
              depthWrite={false}
              side={2}
            />
          </mesh>
        </group>
      ))}
      {[-0.28, 0, 0.28].map((x, i) => (
        <mesh key={x} position={[x, 0, -12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 23, 6]} />
          <meshBasicMaterial
            color={i === 1 ? "#38bdf8" : "#d4af37"}
            transparent
            opacity={0.55}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
      <group position={[0, -1.5, -18]} rotation={[0, -0.2, 0]}>
        <RoundedBox args={[5, 0.22, 3]} radius={0.08}>
          <meshStandardMaterial
            color="#29323d"
            metalness={0.9}
            roughness={0.3}
          />
        </RoundedBox>
        <group ref={bars}>
          {[1.15, 2.1, 3.3].map((height, i) => (
            <group key={i} position={[(i - 1) * 1.35, 0, 0]}>
              <RoundedBox
                args={[0.82, height, 0.9]}
                position={[0, height / 2, 0]}
                radius={0.06}
              >
                <meshStandardMaterial
                  color={i === metric ? gold : slate}
                  metalness={0.78}
                  roughness={0.25}
                  emissive={i === metric ? "#805d17" : "#0b1926"}
                  emissiveIntensity={0.2}
                />
              </RoundedBox>
              <mesh
                position={[0, height + 0.05, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[0.7, 0.8]} />
                <meshBasicMaterial
                  color={i === metric ? "#e4c76b" : "#38bdf8"}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <group position={[0, 0, -27]} rotation={[0.12, -0.18, 0.05]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0, -i * 0.5]}>
            <torusGeometry args={[2.2 - i * 0.3, 0.025, 8, 80]} />
            <meshBasicMaterial color={i === 1 ? "#38bdf8" : "#d4af37"} />
          </mesh>
        ))}
        <RoundedBox args={[1.6, 2.7, 0.7]} radius={0.08}>
          <meshStandardMaterial
            color="#283644"
            metalness={0.9}
            roughness={0.18}
          />
        </RoundedBox>
      </group>
    </>
  );
}
export default function JourneyScene(props: JourneyProps) {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  const lost = useRef(props.onLost);
  lost.current = props.onLost;
  const detach = useRef(() => {});
  useEffect(() => () => detach.current(), []);
  return (
    <Canvas
      frameloop={visible ? "always" : "never"}
      dpr={props.compact ? [1, 2] : [1, 1.5]}
      camera={{ position: [7, 4, 14], fov: props.compact ? 54 : 42, near: 0.1, far: 70 }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        detach.current();
        const fail = (event: Event) => {
          event.preventDefault();
          lost.current();
        };
        gl.domElement.addEventListener("webglcontextlost", fail);
        detach.current = () =>
          gl.domElement.removeEventListener("webglcontextlost", fail);
        props.onReady();
      }}
    >
      <World progress={props.progress} metric={props.metric} compact={props.compact} />
    </Canvas>
  );
}
