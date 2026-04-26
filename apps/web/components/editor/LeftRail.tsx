"use client";

import * as React from "react";
import { Plus, Eye, EyeOff, Room as RoomIcon } from "@/components/icons";
import { useEditor, selectActiveFloor } from "@/lib/store/editor";

export function LeftRail() {
  const floors = useEditor((s) => s.floors);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const setActiveFloorId = useEditor((s) => s.setActiveFloorId);
  const addFloor = useEditor((s) => s.addFloor);
  const deleteFloor = useEditor((s) => s.deleteFloor);
  const renameFloor = useEditor((s) => s.renameFloor);
  const layers = useEditor((s) => s.layers);
  const toggleLayer = useEditor((s) => s.toggleLayer);
  const addLayer = useEditor((s) => s.addLayer);
  const removeLayer = useEditor((s) => s.removeLayer);
  const activeFloor = useEditor(selectActiveFloor);
  const selectedRoomId = useEditor((s) => s.selectedRoomId);
  const setSelectedRoomId = useEditor((s) => s.setSelectedRoomId);
  const addRoom = useEditor((s) => s.addRoom);
  const deleteRoom = useEditor((s) => s.deleteRoom);
  const updateRoomDirect = useEditor((s) => s.updateRoomDirect);

  const [editingFloor, setEditingFloor] = React.useState<string | null>(null);
  const [editingRoom, setEditingRoom] = React.useState<string | null>(null);
  const [addingRoom, setAddingRoom] = React.useState(false);
  const [newRoomName, setNewRoomName] = React.useState("");
  const [addingLayer, setAddingLayer] = React.useState(false);
  const [newLayerName, setNewLayerName] = React.useState("");

  const submitNewRoom = () => {
    const n = newRoomName.trim();
    if (n) addRoom(n, 9, "private");
    setNewRoomName("");
    setAddingRoom(false);
  };

  const submitNewLayer = () => {
    const n = newLayerName.trim();
    if (n) addLayer(n);
    setNewLayerName("");
    setAddingLayer(false);
  };

  return (
    <div className="surface-1 border-r border-border-subtle overflow-y-auto text-sm scrollbar-thin">
      {/* Floors */}
      <Section
        title="Floors"
        action={<button className="text-tertiary hover:text-primary size-[18px] grid place-items-center" onClick={addFloor} title="Add floor"><Plus size={14} /></button>}
      >
        {floors.map((f) => (
          <Row
            key={f.id}
            active={f.id === activeFloorId}
            onClick={() => setActiveFloorId(f.id)}
            onDoubleClick={() => setEditingFloor(f.id)}
          >
            <span className="mono text-2xs text-tertiary w-[18px]">{f.num}</span>
            {editingFloor === f.id ? (
              <input
                autoFocus
                defaultValue={f.name}
                onBlur={(e) => {
                  renameFloor(f.id, e.target.value);
                  setEditingFloor(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renameFloor(f.id, (e.target as HTMLInputElement).value);
                    setEditingFloor(null);
                  }
                  if (e.key === "Escape") setEditingFloor(null);
                }}
                className="flex-1 bg-surface-3 border border-accent text-primary text-sm px-1.5 py-0.5 rounded-sm outline-none"
              />
            ) : (
              <span className="flex-1 truncate">{f.name}</span>
            )}
            <span className="ml-auto text-tertiary mono text-2xs">
              {f.plan?.rooms.reduce((s, r) => s + (r.actualArea || 0), 0).toFixed(0)} sqm
            </span>
            {floors.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFloor(f.id);
                }}
                className="ml-1 text-tertiary hover:text-danger px-0.5 text-base leading-none"
              >×</button>
            )}
          </Row>
        ))}
      </Section>

      {/* Layers */}
      <Section
        title="Layers"
        action={<button className="text-tertiary hover:text-primary size-[18px] grid place-items-center" onClick={() => setAddingLayer(true)} title="Add layer"><Plus size={14} /></button>}
      >
        {layers.map((l) => (
          <Row key={l.id} dim={!l.visible}>
            <span className="flex-1 truncate">{l.name}</span>
            <button
              className="text-tertiary hover:text-primary size-[18px] grid place-items-center ml-auto"
              onClick={() => toggleLayer(l.id)}
            >
              {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            {l.id.startsWith("l") && (
              <button
                onClick={() => removeLayer(l.id)}
                className="text-tertiary hover:text-danger px-0.5 text-base leading-none ml-1"
              >×</button>
            )}
          </Row>
        ))}
        {addingLayer && (
          <div className="px-4 py-1">
            <input
              autoFocus
              placeholder="Layer name…"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              onBlur={submitNewLayer}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewLayer();
                if (e.key === "Escape") { setAddingLayer(false); setNewLayerName(""); }
              }}
              className="w-full bg-surface-3 border border-accent text-primary text-sm px-1.5 py-1 rounded-sm outline-none"
            />
          </div>
        )}
      </Section>

      {/* Outline */}
      <Section
        title="Outline"
        action={<button className="text-tertiary hover:text-primary size-[18px] grid place-items-center" onClick={() => setAddingRoom(true)} title="Add room"><Plus size={14} /></button>}
      >
        {(activeFloor?.plan?.rooms ?? []).map((r) => (
          <Row
            key={r.id}
            active={selectedRoomId === r.id}
            onClick={() => setSelectedRoomId(r.id)}
            onDoubleClick={() => setEditingRoom(r.id)}
          >
            <span className="text-tertiary inline-flex shrink-0"><RoomIcon size={14} /></span>
            {editingRoom === r.id ? (
              <input
                autoFocus
                defaultValue={r.name}
                onBlur={(e) => {
                  updateRoomDirect(r.id, { name: e.target.value });
                  setEditingRoom(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateRoomDirect(r.id, { name: (e.target as HTMLInputElement).value });
                    setEditingRoom(null);
                  }
                  if (e.key === "Escape") setEditingRoom(null);
                }}
                className="flex-1 bg-surface-3 border border-accent text-primary text-sm px-1.5 py-0.5 rounded-sm outline-none"
              />
            ) : (
              <span className="flex-1 truncate">{r.name}</span>
            )}
            <span className="ml-auto text-tertiary mono text-2xs">{(r.actualArea || 0).toFixed(1)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteRoom(r.id);
              }}
              className="ml-1 text-tertiary hover:text-danger px-0.5 text-base leading-none"
            >×</button>
          </Row>
        ))}
        {addingRoom && (
          <div className="px-4 py-1">
            <input
              autoFocus
              placeholder='e.g. "Study", "Pooja Room"…'
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onBlur={submitNewRoom}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewRoom();
                if (e.key === "Escape") { setAddingRoom(false); setNewRoomName(""); }
              }}
              className="w-full bg-surface-3 border border-accent text-primary text-sm px-1.5 py-1 rounded-sm outline-none"
            />
          </div>
        )}
        {!activeFloor?.plan?.rooms.length && !addingRoom && (
          <div className="px-4 py-3 text-xs text-tertiary">No rooms yet.</div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-border-subtle py-3">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="micro-label">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({
  active,
  dim,
  onClick,
  onDoubleClick,
  children,
}: {
  active?: boolean;
  dim?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-active={active ? "true" : undefined}
      data-hidden={dim ? "true" : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="relative flex items-center h-7 px-4 text-secondary hover:bg-surface-2 hover:text-primary cursor-default gap-2 data-[active=true]:text-primary data-[active=true]:bg-surface-2 data-[active=true]:before:content-[''] data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1 data-[active=true]:before:bottom-1 data-[active=true]:before:w-[2px] data-[active=true]:before:bg-accent data-[hidden=true]:opacity-45"
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {children}
    </div>
  );
}
