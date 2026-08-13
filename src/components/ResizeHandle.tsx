"use client";

import type { PointerEvent } from "react";

export default function ResizeHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="w-1.5 shrink-0 cursor-col-resize touch-none hover:bg-blue-500/30 active:bg-blue-500/50"
    />
  );
}
