"use client";

import { useCallback, useRef, useState, type PointerEvent } from "react";

/**
 * Drag-to-resize width for a fixed-width panel that sits beside a flex-1
 * main content area, split by a draggable divider. `panelSide` says which
 * side of the divider the panel is on, since that flips which drag
 * direction grows vs. shrinks it.
 */
export function useResizableWidth({
  initial,
  min,
  max,
  panelSide,
}: {
  initial: number;
  min: number;
  max: number;
  panelSide: "left" | "right";
}) {
  const [width, setWidth] = useState(initial);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      dragRef.current = { startX: e.clientX, startWidth: width };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaX = e.clientX - drag.startX;
      const widthDelta = panelSide === "right" ? -deltaX : deltaX;
      setWidth(Math.min(max, Math.max(min, drag.startWidth + widthDelta)));
    },
    [panelSide, min, max],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return { width, onPointerDown, onPointerMove, onPointerUp };
}
