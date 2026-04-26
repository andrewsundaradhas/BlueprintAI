"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, Environment, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { useProjectStore } from "@/lib/store/project";
import { extrudePlan, type Extruded, type RoomMesh, type WallSegment, type OpeningFrame } from "@/lib/three/extrude";

const ROOM_FLOOR_COLORS: Record<string, string> = {
  bathroom: "#cbd5e1",
  toilet: "#cbd5e1",
  kitchen: "#e7e5e4",
  balcony: "#9ca3af",
  default: "#d6d3d1",
};

const FIXTURE_COLORS: Record<string, string> = {
  wc:           "#f8fafc",
  washbasin:    "#f8fafc",
  shower:       "#cbd5e1",
  bathtub:      "#f8fafc",
  kitchen_sink: "#94a3b8",
  stove_platform: "#1f2937",
  bed_king:     "#fef3c7",
  bed_double:   "#fef3c7",
  bed_single:   "#fef3c7",
  wardrobe:     "#92400e",
  sofa_3:       "#7f1d1d",
  sofa_2:       "#7f1d1d",
  dining_table_4: "#78350f",
  dining_table_6: "#78350f",
  study_table:  "#78350f",
  tv_unit:      "#1f2937",
  fridge:       "#e5e7eb",
  washing_machine: "#e5e7eb",
};

export function View3D() {
  const plan = useProjectStore((s) => s.plan);
  const extruded = React.useMemo(() => (plan ? extrudePlan(plan) : null), [plan]);

  if (!plan || !extruded) {
    return (
      <div className="w-full h-full grid place-items-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Generate a plan to see the 3D view.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{
          position: [extruded.plotWidth * 1.2, extruded.plotDepth * 0.9, extruded.plotDepth * 1.2],
          fov: 45,
          near: 0.1,
          far: 1000,
        }}
        gl={{ antialias: true }}
      >
        <Scene extruded={extruded} />
      </Canvas>
      <div className="absolute top-3 left-3 text-xs glass rounded-md px-3 py-2 text-muted-foreground">
        Drag to orbit · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}

function Scene({ extruded }: { extruded: Extruded }) {
  const center = React.useMemo(
    () => new THREE.Vector3(extruded.plotWidth / 2, 0, extruded.plotDepth / 2),
    [extruded.plotWidth, extruded.plotDepth],
  );
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[extruded.plotWidth * 1.2, 18, extruded.plotDepth * 0.4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.1}
        shadow-camera-far={80}
      />
      <hemisphereLight args={["#bfdbfe", "#94a3b8", 0.4]} />
      <Sky distance={4500} sunPosition={[100, 30, 50]} inclination={0.49} azimuth={0.25} />
      <Environment preset="city" />

      {/* Ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.001, center.z]}>
        <planeGeometry args={[extruded.plotWidth * 6, extruded.plotDepth * 6]} />
        <meshStandardMaterial color="#86efac" roughness={1} />
      </mesh>

      {/* Plot rectangle outline */}
      <Grid
        args={[extruded.plotWidth, extruded.plotDepth]}
        position={[center.x, 0.001, center.z]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#94a3b8"
        sectionSize={5}
        sectionThickness={1.4}
        sectionColor="#475569"
        fadeDistance={Math.max(extruded.plotWidth, extruded.plotDepth) * 1.5}
        fadeStrength={1.5}
        followCamera={false}
        infiniteGrid={false}
      />

      {extruded.floors.map((f) => (
        <group key={f.level}>
          {f.rooms.map((r) => (
            <RoomFloor key={r.id} room={r} />
          ))}
          {f.walls.map((w, i) => (
            <WallMesh key={`${w.wallId}-${i}-${w.kind}`} seg={w} />
          ))}
          {f.openings.map((o) => (
            <OpeningMesh key={o.openingId} op={o} />
          ))}
          {/* Fixtures */}
          <FixtureGroup extruded={extruded} floorLevel={f.level} />
        </group>
      ))}

      <OrbitControls
        target={[center.x, 1.2, center.z]}
        enableDamping
        dampingFactor={0.07}
        minDistance={3}
        maxDistance={Math.max(extruded.plotWidth, extruded.plotDepth) * 4}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  );
}

function RoomFloor({ room }: { room: RoomMesh }) {
  const shape = React.useMemo(() => {
    const s = new THREE.Shape();
    if (room.polygon.length === 0) return s;
    s.moveTo(room.polygon[0]!.x, room.polygon[0]!.z);
    for (let i = 1; i < room.polygon.length; i++) {
      s.lineTo(room.polygon[i]!.x, room.polygon[i]!.z);
    }
    s.closePath();
    return s;
  }, [room.polygon]);

  const color = ROOM_FLOOR_COLORS[room.type] ?? ROOM_FLOOR_COLORS.default!;

  return (
    <mesh receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, room.floorY + 0.003, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

function WallMesh({ seg }: { seg: WallSegment }) {
  const color =
    seg.kind === "lintel" ? "#cbd5e1" : seg.kind === "sill" ? "#cbd5e1" : "#fafaf9";
  return (
    <mesh
      castShadow
      receiveShadow
      position={[seg.cx, seg.baseY + seg.height / 2, seg.cz]}
      rotation={[0, seg.rotY, 0]}
    >
      <boxGeometry args={[seg.length, seg.height, seg.thickness]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function OpeningMesh({ op }: { op: OpeningFrame }) {
  const isWindow = op.type.startsWith("window");
  const isDoor = op.type.startsWith("door");
  const isVent = op.type === "ventilator";

  // Frame: thin border
  const frameThickness = 0.06;

  return (
    <group position={[op.cx, op.baseY + op.height / 2, op.cz]} rotation={[0, op.rotY, 0]}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[op.width, op.height, op.thickness * 0.6]} />
        <meshStandardMaterial color={isDoor ? "#78350f" : "#1f2937"} roughness={0.6} transparent opacity={0.0} />
      </mesh>
      {/* Frame border (top) */}
      <mesh castShadow position={[0, op.height / 2 - frameThickness / 2, 0]}>
        <boxGeometry args={[op.width, frameThickness, op.thickness * 0.7]} />
        <meshStandardMaterial color={isDoor ? "#78350f" : "#1f2937"} roughness={0.7} />
      </mesh>
      {/* Frame border (bottom) */}
      <mesh castShadow position={[0, -op.height / 2 + frameThickness / 2, 0]}>
        <boxGeometry args={[op.width, frameThickness, op.thickness * 0.7]} />
        <meshStandardMaterial color={isDoor ? "#78350f" : "#1f2937"} roughness={0.7} />
      </mesh>
      {/* Frame sides */}
      <mesh castShadow position={[-op.width / 2 + frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, op.height, op.thickness * 0.7]} />
        <meshStandardMaterial color={isDoor ? "#78350f" : "#1f2937"} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[op.width / 2 - frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, op.height, op.thickness * 0.7]} />
        <meshStandardMaterial color={isDoor ? "#78350f" : "#1f2937"} roughness={0.7} />
      </mesh>
      {/* Glass for windows / vents */}
      {(isWindow || isVent) && (
        <mesh>
          <boxGeometry args={[op.width - 2 * frameThickness, op.height - 2 * frameThickness, 0.02]} />
          <meshPhysicalMaterial
            color="#bae6fd"
            metalness={0.1}
            roughness={0.05}
            transmission={0.8}
            transparent
            opacity={0.4}
          />
        </mesh>
      )}
      {/* Door leaf (slightly angled open) */}
      {isDoor && (
        <group position={[-op.width / 2, 0, 0]} rotation={[0, -0.6, 0]}>
          <mesh castShadow position={[op.width / 2, 0, 0]}>
            <boxGeometry args={[op.width - frameThickness * 2, op.height - frameThickness * 2, 0.04]} />
            <meshStandardMaterial color="#a16207" roughness={0.55} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function FixtureGroup({ extruded, floorLevel }: { extruded: Extruded; floorLevel: number }) {
  const plan = useProjectStore((s) => s.plan);
  if (!plan) return null;
  const f = plan.floors.find((x) => x.level === floorLevel);
  if (!f) return null;
  const baseY = floorLevel * (f.height_mm / 1000);
  return (
    <>
      {f.rooms.flatMap((r) =>
        r.fixtures.map((fx, i) => (
          <FixtureBox
            key={`${r.id}-${i}-${fx.type}`}
            type={fx.type}
            x={fx.position.x / 1000}
            z={fx.position.y / 1000}
            rotY={(-fx.rotation_deg * Math.PI) / 180}
            baseY={baseY}
          />
        )),
      )}
    </>
  );
}

function FixtureBox({ type, x, z, rotY, baseY }: { type: string; x: number; z: number; rotY: number; baseY: number }) {
  const sz = fixtureSize3D(type);
  const color = FIXTURE_COLORS[type] ?? "#9ca3af";
  return (
    <group position={[x, baseY + sz.h / 2 + 0.01, z]} rotation={[0, rotY, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[sz.w, sz.h, sz.d]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

function fixtureSize3D(type: string): { w: number; h: number; d: number } {
  switch (type) {
    case "bed_king":      return { w: 1.8, h: 0.5, d: 2.0 };
    case "bed_double":    return { w: 1.5, h: 0.5, d: 2.0 };
    case "bed_single":    return { w: 1.0, h: 0.5, d: 2.0 };
    case "wardrobe":      return { w: 1.8, h: 2.2, d: 0.6 };
    case "sofa_3":        return { w: 2.1, h: 0.85, d: 0.9 };
    case "sofa_2":        return { w: 1.5, h: 0.85, d: 0.9 };
    case "dining_table_4":return { w: 1.2, h: 0.75, d: 0.9 };
    case "dining_table_6":return { w: 1.8, h: 0.75, d: 0.9 };
    case "study_table":   return { w: 1.2, h: 0.75, d: 0.6 };
    case "tv_unit":       return { w: 1.5, h: 0.5, d: 0.4 };
    case "wc":            return { w: 0.7, h: 0.45, d: 0.5 };
    case "washbasin":     return { w: 0.6, h: 0.85, d: 0.45 };
    case "shower":        return { w: 0.9, h: 2.0, d: 0.9 };
    case "bathtub":       return { w: 1.7, h: 0.55, d: 0.7 };
    case "kitchen_sink":  return { w: 0.8, h: 0.9, d: 0.5 };
    case "stove_platform":return { w: 1.2, h: 0.9, d: 0.6 };
    case "fridge":        return { w: 0.7, h: 1.8, d: 0.7 };
    case "washing_machine": return { w: 0.6, h: 0.85, d: 0.6 };
    default:              return { w: 0.6, h: 0.6, d: 0.6 };
  }
}

// Suppress unused
void Html;
