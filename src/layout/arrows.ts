/**
 * Smart arrow routing with auto-side detection and fixedPoint binding.
 * Ported from excalidraw-mcp elements/arrows.py
 */

import { estimateTextWidth } from './text.js';

export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FIXED_POINTS: Record<Side, [number, number]> = {
  right:  [1.0, 0.5001],
  left:   [0.0, 0.5001],
  bottom: [0.5001, 1.0],
  top:    [0.5001, 0.0],
};

function center(el: BoundingBox): [number, number] {
  return [el.x + el.width / 2, el.y + el.height / 2];
}

function edgePoint(el: BoundingBox, side: Side): [number, number] {
  const { x, y, width: w, height: h } = el;
  switch (side) {
    case 'right':  return [x + w, y + h / 2];
    case 'left':   return [x, y + h / 2];
    case 'bottom': return [x + w / 2, y + h];
    case 'top':    return [x + w / 2, y];
  }
}

export function autoSides(startEl: BoundingBox, endEl: BoundingBox): [Side, Side] {
  const [sx, sy] = center(startEl);
  const [ex, ey] = center(endEl);
  const dx = Math.abs(ex - sx);
  const dy = Math.abs(ey - sy);

  if (dx >= dy) {
    return ex > sx ? ['right', 'left'] : ['left', 'right'];
  } else {
    return ey > sy ? ['bottom', 'top'] : ['top', 'bottom'];
  }
}

export interface ArrowLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  points: [number, number][];
  startSide: Side;
  endSide: Side;
  startFixed: [number, number];
  endFixed: [number, number];
  startElementId: string;
  endElementId: string;
  labelX?: number;
  labelY?: number;
  labelWidth?: number;
  labelHeight?: number;
}

export function computeArrowLayout(
  startEl: BoundingBox,
  endEl: BoundingBox,
  options: {
    startSide?: Side | 'auto';
    endSide?: Side | 'auto';
    elbowed?: boolean;
    label?: string;
    labelFontSize?: number;
  } = {},
): ArrowLayout {
  let { startSide = 'auto', endSide = 'auto' } = options;
  const { elbowed = false, label, labelFontSize = 16 } = options;

  // Auto-detect sides
  if (startSide === 'auto' || endSide === 'auto') {
    const [autoStart, autoEnd] = autoSides(startEl, endEl);
    if (startSide === 'auto') startSide = autoStart;
    if (endSide === 'auto') endSide = autoEnd;
  }

  const resolvedStartSide = startSide as Side;
  const resolvedEndSide = endSide as Side;

  const [startX, startY] = edgePoint(startEl, resolvedStartSide);
  const [endX, endY] = edgePoint(endEl, resolvedEndSide);

  const relDx = endX - startX;
  const relDy = endY - startY;

  // Compute points
  let points: [number, number][];
  if (elbowed && Math.abs(relDx) > 1 && Math.abs(relDy) > 1) {
    if (resolvedStartSide === 'right' || resolvedStartSide === 'left') {
      const midX = relDx / 2;
      points = [[0, 0], [midX, 0], [midX, relDy], [relDx, relDy]];
    } else {
      const midY = relDy / 2;
      points = [[0, 0], [0, midY], [relDx, midY], [relDx, relDy]];
    }
  } else {
    points = [[0, 0], [relDx, relDy]];
  }

  const result: ArrowLayout = {
    x: startX,
    y: startY,
    width: Math.abs(relDx),
    height: Math.abs(relDy),
    points,
    startSide: resolvedStartSide,
    endSide: resolvedEndSide,
    startFixed: FIXED_POINTS[resolvedStartSide],
    endFixed: FIXED_POINTS[resolvedEndSide],
    startElementId: startEl.id,
    endElementId: endEl.id,
  };

  // Label position at midpoint
  if (label) {
    const textWidth = estimateTextWidth(label, labelFontSize);
    const textHeight = labelFontSize * 1.4;
    const midX = startX + relDx / 2;
    const midY = startY + relDy / 2;
    result.labelX = midX - textWidth / 2;
    result.labelY = midY - textHeight / 2;
    result.labelWidth = textWidth;
    result.labelHeight = textHeight;
  }

  return result;
}
