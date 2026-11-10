import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { ReactNode } from 'react';

/** Studio lighting built from local light panels — no HDR download, works offline. */
export function Studio() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 7, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#9db8ff" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#15171b']} />
        <Lightformer intensity={3} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
        <Lightformer intensity={1.6} position={[-6, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[8, 2, 1]} />
        <Lightformer intensity={1.6} position={[6, 2, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 2, 1]} />
        <Lightformer intensity={0.8} position={[0, 2, -7]} scale={[12, 3, 1]} color="#ffd9a0" />
      </Environment>
    </>
  );
}

/** Rotate / zoom / inspect a car in real time. */
export function CarViewer({ children, autoRotate = true, height, distance = 7.2 }: { children: ReactNode; autoRotate?: boolean; height?: number | string; distance?: number }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [distance * 0.72, distance * 0.3, distance * 0.62], fov: 32 }} style={{ height: height ?? '100%' }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <Studio />
      <group position={[0, -0.55, 0]}>
        {children}
        <ContactShadows position={[0, 0.001, 0]} opacity={0.75} scale={12} blur={2.2} far={3} resolution={512} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow><circleGeometry args={[7, 64]} /><meshStandardMaterial color="#1b1e23" roughness={0.85} metalness={0.1} /></mesh>
        <gridHelper args={[14, 14, '#2c3037', '#22252a']} position={[0, 0.001, 0]} />
      </group>
      <OrbitControls makeDefault enablePan={false} minDistance={3.5} maxDistance={14} maxPolarAngle={Math.PI / 2 - 0.03} autoRotate={autoRotate} autoRotateSpeed={0.7} target={[0, 0.1, 0]} />
    </Canvas>
  );
}
