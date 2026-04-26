"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, Environment, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { SolvedPlan, SolvedRoom } from "@/lib/solver/solver";
import { useEditor, selectActiveFloor } from "@/lib/store/editor";

const MM_TO_M = 0.001;
const HEIGHT_M = 3.0;
const TE_M = 0.230;
const TI_M = 0.115;

function roomColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("master") || n.includes("bed")) return "#cbd5e1";
  if (n.includes("bath") || n.includes("toilet")) return "#a3b8c8";
  if (n.includes("kitchen")) return "#e7e5e4";
  if (n.includes("living") || n.includes("dining")) return "#d6d3d1";
  if (n.includes("balcony")) return "#9ca3af";
  return "#d6d3d1";
}

export function View3D() {
  const floor = useEditor(selectActiveFloor);
  const accent = "#2D7FF9";
  if (!floor?.plan) {
    return (
      <div className="w-full h-full grid place-items-center text-tertiary text-sm">
        Generate a plan to see the 3D view.
      </div>
    );
  }
  const plan = floor.plan;

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{
          position: [
            (plan.plot.w * MM_TO_M) * 1.4,
            Math.max(plan.plot.w, plan.plot.h) * MM_TO_M * 0.9,
            (plan.plot.h * MM_TO_M) * 1.4,
          ],
          fov: 45,
          near: 0.1,
          far: 1000,
        }}
        gl={{ antialias: true }}
      >
        <Scene plan={plan} accent={accent} />
      </Canvas>
      <div className="absolute top-3 left-3 mono text-xs text-tertiary bg-surface-1 border border-border-subtle px-2 py-1 rounded-sm">
        Drag to orbit · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}

function Scene({ plan, accent }: { plan: SolvedPlan; accent: string }) {
  const W = plan.plot.w * MM_TO_M;
  const H = plan.plot.h * MM_TO_M;
  const cx = W / 2;
  const cz = H / 2;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[W * 1.2, 18, H * 0.4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <hemisphereLight args={["#bfdbfe", "#94a3b8", 0.4]} />
      <Sky distance={4500} sunPosition={[100, 30, 50]} inclination={0.49} azimuth={0.25} />
      <Environment preset="city" />

      {/* Ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.001, cz]}>
        <planeGeometry args={[W * 6, H * 6]} />
        <meshStandardMaterial color="#86efac" roughness={1} />
      </mesh>

      {/* Plot grid */}
      <Grid
        args={[W, H]}
        position={[cx, 0.001, cz]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#94a3b8"
        sectionSize={5}
        sectionThickness={1.4}
        sectionColor="#475569"
        fadeDistance={Math.max(W, H) * 1.5}
        fadeStrength={1.5}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Room floors (tinted by name) */}
      {plan.rooms.map((r) => (
        <RoomFloor key={r.id} room={r} accent={accent} />
      ))}

      {/* Exterior walls — perimeter as 4 thin tall boxes */}
      {[
        // top
        { x: cx, z: TE_M / 2, w: W, d: TE_M },
        // bottom
        { x: cx, z: H - TE_M / 2, w: W, d: TE_M },
        // left
        { x: TE_M / 2, z: cz, w: TE_M, d: H },
        // right
        { x: W - TE_M / 2, z: cz, w: TE_M, d: H },
      ].map((w, i) => (
        <mesh key={`ext-${i}`} castShadow receiveShadow position={[w.x, HEIGHT_M / 2, w.z]}>
          <boxGeometry args={[w.w, HEIGHT_M, w.d]} />
          <meshStandardMaterial color="#fafaf9" roughness={0.85} />
        </mesh>
      ))}

      {/* Interior walls — derived from shared edges between rooms */}
      <InteriorWalls plan={plan} />

      <OrbitControls
        target={[cx, 1.2, cz]}
        enableDamping
        dampingFactor={0.07}
        minDistance={3}
        maxDistance={Math.max(W, H) * 4}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  );
}

function RoomFloor({ room, accent }: { room: SolvedRoom; accent: string }) {
  const x = room.x * MM_TO_M;
  const z = room.y * MM_TO_M;
  const w = room.w * MM_TO_M;
  const d = room.h * MM_TO_M;
  const baseColor = roomColor(room.name);
  void accent;
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x + w / 2, 0.005, z + d / 2]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={baseColor} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

function InteriorWalls({ plan }: { plan: SolvedPlan }) {
  const segs = React.useMemo(() => {
    const out: { kind: "v" | "h"; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < plan.rooms.length; i++) {
      for (let j = i + 1; j < plan.rooms.length; j++) {
        const a = plan.rooms[i]!;
        const b = plan.rooms[j]!;
        if (Math.abs(a.x + a.w - b.x) < 200 || Math.abs(b.x + b.w - a.x) < 200) {
          const x =
            Math.abs(a.x + a.w - b.x) < 200
              ? (a.x + a.w + b.x) / 2
              : (a.x + b.x + b.w) / 2;
          const y1 = Math.max(a.y, b.y);
          const y2 = Math.min(a.y + a.h, b.y + b.h);
          if (y2 > y1) out.push({ kind: "v", x1: x, y1, x2: x, y2 });
        }
        if (Math.abs(a.y + a.h - b.y) < 200 || Math.abs(b.y + b.h - a.y) < 200) {
          const y =
            Math.abs(a.y + a.h - b.y) < 200
              ? (a.y + a.h + b.y) / 2
              : (a.y + b.y + b.h) / 2;
          const x1 = Math.max(a.x, b.x);
          const x2 = Math.min(a.x + a.w, b.x + b.w);
          if (x2 > x1) out.push({ kind: "h", x1, y1: y, x2, y2: y });
        }
      }
    }
    return out;
  }, [plan.rooms]);

  return (
    <>
      {segs.map((s, i) => {
        const x1 = s.x1 * MM_TO_M;
        const y1 = s.y1 * MM_TO_M;
        const x2 = s.x2 * MM_TO_M;
        const y2 = s.y2 * MM_TO_M;
        const cx = (x1 + x2) / 2;
        const cz = (y1 + y2) / 2;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const isVertical = s.kind === "v";
        return (
          <mesh
            key={i}
            castShadow
            receiveShadow
            position={[cx, HEIGHT_M / 2, cz]}
            rotation={[0, isVertical ? Math.PI / 2 : 0, 0]}
          >
            <boxGeometry args={[len, HEIGHT_M, TI_M]} />
            <meshStandardMaterial color="#f4f4f5" roughness={0.85} />
          </mesh>
        );
      })}
    </>
  );
}
