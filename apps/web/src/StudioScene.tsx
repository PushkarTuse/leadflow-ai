import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox } from '@react-three/drei';
import { CatmullRomCurve3, Group, MathUtils, Shape, Vector3 } from 'three';

interface Props { progress: RefObject<{value: number}>; compact: boolean; onReady: () => void; onLost: () => void }
const jade = '#93c9b2', platinum = '#d3d2c5';
function Panel({width, height, depth = 0.08, color = '#182b27'}: {width: number; height: number; depth?: number; color?: string}) {
  return <RoundedBox args={[width, height, depth]} radius={0.06} smoothness={3}>
    <meshStandardMaterial color={color} metalness={0.7} roughness={0.26}/>
  </RoundedBox>;
}
function Browser() {
  return <group>
    <Panel width={4.9} height={3.1} depth={0.16}/>
    <mesh position={[0, 0, 0.1]}><planeGeometry args={[4.65, 2.86]}/><meshStandardMaterial color="#0e1a17" metalness={0.4} roughness={0.2}/></mesh>
    {[-2.05, -1.84, -1.63].map((x, i) => <mesh key={x} position={[x, 1.22, 0.15]}><circleGeometry args={[0.045, 12]}/><meshBasicMaterial color={i === 0 ? jade : '#4b655a'}/></mesh>)}
    <group position={[-0.8, 0.1, 0.16]}>
      {[1.9, 1.5, 1.1].map((w, i) => <mesh position={[(w - 1.9) / 2, 0.45 - i * 0.24, 0]} key={i}><planeGeometry args={[w, i === 0 ? 0.1 : 0.035]}/><meshBasicMaterial color={i === 0 ? platinum : '#4b6a5c'}/></mesh>)}
      <mesh position={[-0.55, -0.55, 0]}><planeGeometry args={[0.8, 0.25]}/><meshBasicMaterial color={jade}/></mesh>
    </group>
    <mesh position={[1.25, -0.04, 0.42]} rotation={[0.3, 0.4, 0.1]}><icosahedronGeometry args={[0.73, 0]}/><meshStandardMaterial color={jade} metalness={0.9} roughness={0.2}/></mesh>
  </group>;
}
function Mobile() {
  return <group rotation={[0.05, -0.28, -0.1]}>
    <Panel width={1.8} height={3.5} depth={0.24} color="#71857a"/>
    <group position={[0, 0, 0.14]}><Panel width={1.64} height={3.32} color="#0e1815"/>
      <mesh position={[0, 1.35, 0.05]}><planeGeometry args={[0.5, 0.08]}/><meshBasicMaterial color="#71857a"/></mesh>
      {[0, 1, 2].map(i => <group key={i} position={[0, 0.65 - i * 0.72, 0.08]}><Panel width={1.35} height={0.53} depth={0.025} color={i === 0 ? '#659f85' : '#293f34'}/></group>)}
      <mesh position={[0, -1.43, 0.06]}><planeGeometry args={[0.5, 0.04]}/><meshBasicMaterial color={platinum}/></mesh>
    </group>
  </group>;
}
function World({progress, compact}: Pick<Props, 'progress' | 'compact'>) {
  const assembly = useRef<Group>(null), spatial = useRef<Group>(null);
  const mouse = useRef({x: 0, y: 0});
  useEffect(() => {
    const move = (event: PointerEvent) => { mouse.current.x = event.clientX / innerWidth * 2 - 1; mouse.current.y = 1 - event.clientY / innerHeight * 2; };
    const leave = () => { mouse.current.x = 0; mouse.current.y = 0; };
    window.addEventListener('pointermove', move, {passive: true});
    document.documentElement.addEventListener('pointerleave', leave);
    return () => { window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); };
  }, []);
  const path = useMemo(() => new CatmullRomCurve3([
    new Vector3(6.6, 4.5, 11), new Vector3(2.4, 1.3, -1.5),
    new Vector3(3.5, 1.5, -10.5), new Vector3(2.6, 1, -15.5), new Vector3(4.2, 2.6, -23),
  ]), []);
  const targets = useMemo(() => new CatmullRomCurve3([
    new Vector3(0, 0, 0), new Vector3(0, 0, -6),
    new Vector3(0, 0, -14.5), new Vector3(0, 0, -20), new Vector3(0, 0, -28),
  ]), []);
  const vectors = useMemo(() => ({position: new Vector3(), target: new Vector3()}), []);
  const current = useRef(0);
  const shield = useMemo(() => {
    const s = new Shape(); s.moveTo(0, 2); s.lineTo(1.7, 1.3); s.lineTo(1.45, -0.8); s.quadraticCurveTo(0.9, -1.8, 0, -2.3);
    s.quadraticCurveTo(-0.9, -1.8, -1.45, -0.8); s.lineTo(-1.7, 1.3); s.closePath(); return s;
  }, []);
  const nodes = useMemo(() => Array.from({length: compact ? 24 : 48}, (_, i) => [Math.sin(i * 51.7) * 6, Math.cos(i * 17.3) * 3.2, -((i * 1.618) % 31)] as [number, number, number]), [compact]);
  useFrame(({camera, clock}, delta) => {
    const dt = Math.min(delta, 0.05);
    current.current = MathUtils.damp(current.current, progress.current.value, 4.5, dt);
    // Match spline control points to the narrative, rather than equal travel distances.
    const stops = [0, 0.3, 0.48, 0.65, 1];
    let segment = stops.findIndex((stop, i) => i > 0 && current.current < stop) - 1;
    if (segment < 0) segment = 3;
    const t = (segment + (current.current - stops[segment]) / (stops[segment + 1] - stops[segment])) / 4;
    path.getPoint(t, vectors.position); targets.getPoint(t, vectors.target);
    vectors.position.x += mouse.current.x * 0.2; vectors.position.y += mouse.current.y * 0.12;
    camera.position.copy(vectors.position); camera.lookAt(vectors.target);
    if (assembly.current) { assembly.current.rotation.y = Math.sin(clock.elapsedTime * 0.13) * 0.08; assembly.current.position.y = Math.sin(clock.elapsedTime * 0.55) * 0.08; }
    if (spatial.current) { spatial.current.rotation.y = clock.elapsedTime * 0.16; spatial.current.rotation.x = Math.sin(clock.elapsedTime * 0.25) * 0.2; }
  });
  return <>
    <color attach="background" args={['#0a100e']}/><fog attach="fog" args={['#0a100e', 12, 28]}/>
    <ambientLight intensity={0.8}/>
    <directionalLight position={[5, 8, 6]} color="#e6e0c7" intensity={3}/>
    <pointLight position={[-4, 2, 3]} color={jade} intensity={30} distance={20}/>
    <pointLight position={[0, 3, -16]} color={jade} intensity={40} distance={20}/>
    <Environment resolution={64} frames={1}>
      <Lightformer position={[0, 6, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 4, 1]} intensity={3} color="#e2ded0"/>
      <Lightformer position={[-5, 0, -4]} rotation={[0, Math.PI / 2, 0]} scale={[4, 8, 1]} intensity={2} color={jade}/>
    </Environment>
    <gridHelper args={[32, 32, '#365b4a', '#1b3027']} position={[0, -2.5, -10]}/>
    {nodes.map((position, i) => <mesh key={i} position={position} rotation={[i, i / 2, 0]}><octahedronGeometry args={[i % 5 === 0 ? 0.09 : 0.035]}/><meshBasicMaterial color={i % 4 === 0 ? platinum : '#477561'}/></mesh>)}
    <group ref={assembly}>
      <group rotation={[0.14, 0.2, -0.06]}>
        {[-1.15, -0.75, -0.35].map((y, i) => <group key={i} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Panel width={4.4 - i * 0.25} height={3.3 - i * 0.25} depth={0.07} color={i === 2 ? '#436959' : '#1b3227'}/>
          <mesh position={[0, 0, 0.05]}><planeGeometry args={[4.1 - i * 0.25, 3 - i * 0.25, 6, 5]}/><meshBasicMaterial color={jade} wireframe transparent opacity={0.2}/></mesh>
        </group>)}
        <mesh position={[0, 0.75, 0]} rotation={[0.2, 0.4, 0.08]}><boxGeometry args={[2.15, 2.15, 2.15]}/><meshStandardMaterial color="#a7bcad" metalness={0.55} roughness={0.32}/></mesh>
        <mesh position={[0, 0.75, 0]} rotation={[0.2, 0.4, 0.08]}><boxGeometry args={[2.75, 2.75, 2.75]}/><meshBasicMaterial color={jade} wireframe transparent opacity={0.62}/></mesh>
        {[0, 1, 2, 3].map(i => <mesh key={i} position={[(i % 2 ? 1 : -1) * 2.15, 0.5, (i > 1 ? 1 : -1) * 1.6]}><boxGeometry args={[0.02, 3.5, 0.02]}/><meshBasicMaterial color="#749480" transparent opacity={0.5}/></mesh>)}
      </group>
    </group>
    <group position={[0, 0, -6]} rotation={[0.04, 0.12, -0.02]}><Browser/></group>
    <group position={[0.25, 0, -10.5]}><Mobile/></group>
    <group ref={spatial} position={[0, 0, -14.5]}>
      <mesh><icosahedronGeometry args={[1.45, 0]}/><meshStandardMaterial color="#829b8a" metalness={0.95} roughness={0.16}/></mesh>
      <mesh><icosahedronGeometry args={[1.9, 0]}/><meshBasicMaterial wireframe color={jade}/></mesh>
      {[0, 1].map(i => <mesh key={i} rotation={[i * Math.PI / 2, 0, 0]}><torusGeometry args={[2.25, 0.015, 6, 72]}/><meshBasicMaterial color="#7b9b86"/></mesh>)}
    </group>
    <group position={[0, 0, -20]} rotation={[0, -0.08, 0]}>
      {[0, 1, 2].map(i => <mesh key={i} position={[0, 0, -i * 0.65]} scale={1 + i * 0.1}>
        <extrudeGeometry args={[shield, {depth: 0.12, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.035, bevelThickness: 0.03}]}/>
        <meshStandardMaterial color={i === 0 ? '#567b66' : '#233c2f'} metalness={0.85} roughness={0.25} wireframe={i === 2}/>
      </mesh>)}
      <group position={[0, 0, 0.2]}><mesh rotation={[0, 0, -0.15]}><torusGeometry args={[0.45, 0.045, 8, 40]}/><meshBasicMaterial color={platinum}/></mesh><mesh position={[0, -0.43, 0]}><boxGeometry args={[0.06, 0.5, 0.06]}/><meshBasicMaterial color={platinum}/></mesh></group>
    </group>
    <group position={[0, 0, -28]} rotation={[0.05, 0.3, 0]}><Browser/></group>
  </>;
}
export default function StudioScene(props: Props) {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => { const change = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', change); return () => document.removeEventListener('visibilitychange', change); }, []);
  const lost = useRef(props.onLost); lost.current = props.onLost;
  const detach = useRef(() => {});
  useEffect(() => () => detach.current(), []);
  return <Canvas frameloop={visible ? 'always' : 'never'} dpr={props.compact ? [1, 2] : [1, 1.5]} camera={{position: [6.6, 4.5, 11], fov: props.compact ? 52 : 40, near: 0.1, far: 65}}
    gl={{alpha: false, antialias: true, powerPreference: 'low-power'}}
    onCreated={({gl}) => {
      detach.current(); const fail = (event: Event) => {event.preventDefault(); lost.current();};
      gl.domElement.addEventListener('webglcontextlost', fail); detach.current = () => gl.domElement.removeEventListener('webglcontextlost', fail); props.onReady();
    }}><World progress={props.progress} compact={props.compact}/></Canvas>;
}
