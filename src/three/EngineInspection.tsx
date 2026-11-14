// Original procedural powertrain for the vehicle-studio inspection mode.
// Presentation only. All visible proportions and components come from VehicleSpec.engine.
// It is intentionally a standalone inspection model, not an engine falsely shown under the GLB bonnet.
import type { EngineSpec } from '../sim/types';
import { powertrainBlueprint } from './powertrain';

const iron = '#2e3339';
const alloy = '#8d9aa6';
const black = '#161b22';
const edge = '#aebbc6';
const rubber = '#24272c';
const copper = '#b56f3b';

function Box({ at, size, color, metalness = 0.75 }: { at: [number, number, number]; size: [number, number, number]; color: string; metalness?: number }) {
  return <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} metalness={metalness} roughness={0.35} />
  </mesh>;
}
function Round({ at, radius, height, color, rotation = [0, 0, Math.PI / 2], segments = 32 }: {
  at: [number, number, number]; radius: number; height: number; color: string; rotation?: [number, number, number]; segments?: number;
}) {
  return <mesh position={at} rotation={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, height, segments]} />
    <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
  </mesh>;
}

/** Cylinders are visibly grouped into inline, V or opposed/flat banks, rather than showing a generic V8. */
function CombustionEngine({ engine }: { engine: EngineSpec }) {
  const bp = powertrainBlueprint(engine);
  const length = bp.length;
  const cc = (engine.displacement / 1000).toFixed(1);
  const cover = engine.aluBlock ? '#a5adb6' : '#4b5965';
  return <group name={`powertrain_${bp.layout}_${cc}L`} position={[0, 0.62, 0]}>
    {/* Crankcase, sump, cylinder block and gearbox bellhousing. +X is the front of the engine. */}
    <Box at={[0, -0.11, 0]} size={[length, 0.44, 0.54]} color={iron} />
    <Box at={[-0.04, -0.41, 0]} size={[length * 0.82, 0.17, 0.40]} color="#30353b" />
    <Box at={[-length * 0.51, -0.12, 0]} size={[0.22, 0.45, 0.59]} color={alloy} />
    {bp.banks.map((bank, index) => <group key={index} position={[0, 0.15, bank.z]} rotation={[bank.roll, 0, 0]}>
      <Box at={[0, 0.02, 0]} size={[length * 0.95, 0.31, bp.banks.length > 1 ? 0.27 : 0.44]} color={cover} />
      {/* Subtle cam-cover ribs follow the actual cylinder count. */}
      {Array.from({ length: bank.cylinders }, (_, i) => {
        const x = (i - (bank.cylinders - 1) / 2) * (length * 0.72 / Math.max(bank.cylinders, 1));
        return <group key={i}>
          <Box at={[x, 0.19, 0]} size={[0.035, 0.018, bp.banks.length > 1 ? 0.2 : 0.37]} color={edge} />
          <Round at={[x, 0.21, 0]} radius={0.025} height={0.018} color={black} rotation={[Math.PI / 2, 0, 0]} segments={12} />
        </group>;
      })}
      <Box at={[0, 0.225, 0]} size={[length * 0.73, 0.034, bp.banks.length > 1 ? 0.17 : 0.30]} color={black} />
    </group>)}
    {/* Timing cover, pulleys, accessory belt and alternator. */}
    <Box at={[length * 0.50, -0.04, 0]} size={[0.09, 0.39, 0.51]} color={black} />
    <Round at={[length * 0.59, -0.22, 0]} radius={0.17} height={0.06} color={rubber} />
    <Round at={[length * 0.63, -0.22, 0]} radius={0.075} height={0.07} color={alloy} />
    <Round at={[length * 0.59, 0.10, -0.18]} radius={0.095} height={0.06} color={rubber} />
    <Round at={[length * 0.64, 0.10, -0.18]} radius={0.04} height={0.07} color={alloy} />
    <Round at={[-length * 0.29, -0.25, 0.43]} radius={0.15} height={0.23} color={alloy} rotation={[Math.PI / 2, 0, 0]} />
    {/* Intake runners, intake plenum and exhaust manifolds. */}
    <Box at={[0, 0.50, 0]} size={[length * 0.61, 0.19, bp.banks.length > 1 ? 0.25 : 0.36]} color={black} />
    {[-1, 1].map(side => <group key={side}>
      <Round at={[-0.03, -0.05, side * 0.36]} radius={0.057} height={length * 0.71} color={alloy} rotation={[0, 0, Math.PI / 2]} />
      <Round at={[-length * 0.38, -0.11, side * 0.38]} radius={0.042} height={0.19} color={iron} rotation={[Math.PI / 2, 0, 0]} />
    </group>)}
    {bp.forcedInduction && <group name="forced_induction">
      <Round at={[0.08, -0.02, 0.53]} radius={0.17} height={0.14} color={alloy} rotation={[Math.PI / 2, 0, 0]} />
      <Round at={[0.08, -0.02, 0.62]} radius={0.085} height={0.02} color={iron} rotation={[Math.PI / 2, 0, 0]} />
      <Round at={[-0.21, 0.23, 0.43]} radius={0.065} height={0.48} color={edge} />
    </group>}
    {engine.hybridKw > 0 && <group name="hybrid_assist">
      <Box at={[-length * 0.62, -0.12, 0]} size={[0.21, 0.43, 0.49]} color={copper} />
      {Array.from({ length: 5 }, (_, i) => <Box key={i} at={[-length * 0.62 - 0.09 + i * 0.04, -0.12, 0.255]} size={[0.018, 0.34, 0.013]} color={edge} />)}
    </group>}
  </group>;
}

function ElectricDrive({ engine }: { engine: EngineSpec }) {
  const cells = Math.max(4, Math.min(12, Math.round(engine.batteryKwh / 10)));
  return <group name={`powertrain_EV_${Math.round(engine.motorKw)}kW`} position={[0, 0.59, 0]}>
    {/* Battery modules are shown in an exploded inspection layout, not claimed to be under the bonnet. */}
    <Box at={[0, -0.35, 0]} size={[1.9, 0.14, 0.91]} color={black} />
    <Box at={[0, -0.26, 0]} size={[1.82, 0.06, 0.85]} color={copper} />
    {Array.from({ length: cells }, (_, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      return <Box key={i} at={[-0.62 + col * 0.41, -0.20, -0.27 + row * 0.28]} size={[0.36, 0.10, 0.23]} color={i % 2 ? '#657d8b' : '#8398a7'} />;
    })}
    <Round at={[0.01, 0.20, 0]} radius={0.32} height={0.74} color={alloy} />
    {Array.from({ length: 8 }, (_, i) => <Box key={i} at={[-0.27 + i * 0.076, 0.20, 0.325]} size={[0.023, 0.46, 0.012]} color={iron} />)}
    <Box at={[-0.55, 0.14, 0]} size={[0.32, 0.50, 0.43]} color={iron} />
    <Box at={[0.59, 0.17, 0]} size={[0.33, 0.28, 0.42]} color={black} />
    <Box at={[0.59, 0.34, 0]} size={[0.29, 0.055, 0.39]} color={copper} />
    <Round at={[0.79, 0.2, 0]} radius={0.09} height={0.15} color={iron} />
  </group>;
}

export function EngineInspection({ engine }: { engine: EngineSpec }) {
  return <group>
    <group name="powertrain_inspection">
      {engine.layout === 'EV' ? <ElectricDrive engine={engine} /> : <CombustionEngine engine={engine} />}
    </group>
  </group>;
}
