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

/**
 * Distribute multiple arrows along one edge of a box.
 * Returns a fixedPoint for the i-th arrow out of `count` arrows on `side`.
 */
export function distributeFixedPoints(
  count: number,
  side: Side,
  index: number,
): [number, number] {
  if (count <= 1) return FIXED_POINTS[side];
  const margin = 0.18;
  const range = 1 - 2 * margin;
  const step = range / (count - 1);
  const t = margin + step * index;
  switch (side) {
    case 'top':    return [t, 0.0];
    case 'bottom': return [t, 1.0];
    case 'left':   return [0.0, t];
    case 'right':  return [1.0, t];
  }
}

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

function edgePointFromFixed(el: BoundingBox, fixed: [number, number]): [number, number] {
  return [el.x + fixed[0] * el.width, el.y + fixed[1] * el.height];
}

export function autoSides(
  startEl: BoundingBox,
  endEl: BoundingBox,
  options?: { layered?: boolean },
): [Side, Side] {
  const [sx, sy] = center(startEl);
  const [ex, ey] = center(endEl);
  const dx = Math.abs(ex - sx);
  const dy = Math.abs(ey - sy);

  // In layered diagrams, prefer vertical connections unless boxes are in the same row
  if (options?.layered && dy > startEl.height * 0.5) {
    return ey > sy ? ['bottom', 'top'] : ['top', 'bottom'];
  }

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
    labelBias?: number;
    startFixedOverride?: [number, number];
    endFixedOverride?: [number, number];
    labelYOverride?: number;
  } = {},
): ArrowLayout {
  let { startSide = 'auto', endSide = 'auto' } = options;
  const { elbowed = false, label, labelFontSize = 16, labelBias = 0.5, startFixedOverride, endFixedOverride, labelYOverride } = options;

  // Auto-detect sides
  if (startSide === 'auto' || endSide === 'auto') {
    const [autoStart, autoEnd] = autoSides(startEl, endEl);
    if (startSide === 'auto') startSide = autoStart;
    if (endSide === 'auto') endSide = autoEnd;
  }

  const resolvedStartSide = startSide as Side;
  const resolvedEndSide = endSide as Side;

  const startFixed = startFixedOverride || FIXED_POINTS[resolvedStartSide];
  const endFixed = endFixedOverride || FIXED_POINTS[resolvedEndSide];

  const [startX, startY] = startFixedOverride
    ? edgePointFromFixed(startEl, startFixedOverride)
    : edgePoint(startEl, resolvedStartSide);
  const [endX, endY] = endFixedOverride
    ? edgePointFromFixed(endEl, endFixedOverride)
    : edgePoint(endEl, resolvedEndSide);

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
    startFixed,
    endFixed,
    startElementId: startEl.id,
    endElementId: endEl.id,
  };

  // Label position — prefer gap-aware placement, fall back to bias
  if (label) {
    const textWidth = estimateTextWidth(label, labelFontSize);
    const textHeight = labelFontSize * 1.4;

    let lx: number;
    let ly: number;
    if (labelYOverride !== undefined) {
      // Place label at the specified Y, centered on the arrow's x at that y
      ly = labelYOverride;
      // Interpolate x: how far along the arrow at this y?
      const t = relDy !== 0 ? (ly - startY) / relDy : labelBias;
      lx = startX + relDx * Math.max(0, Math.min(1, t));
    } else {
      lx = startX + relDx * labelBias;
      ly = startY + relDy * labelBias;
    }
    result.labelX = lx - textWidth / 2;
    result.labelY = ly - textHeight / 2;
    result.labelWidth = textWidth;
    result.labelHeight = textHeight;
  }

  return result;
}

// --- Batch arrow planning with distributed fixedPoints ---

export interface ConnectionDef {
  startEl: BoundingBox;
  endEl: BoundingBox;
  label?: string;
  [key: string]: any;
}

/**
 * Plan arrow layouts for multiple connections with distributed fixedPoints
 * to prevent arrow bundling when multiple arrows share the same edge.
 */
export function planDistributedArrows(
  connections: ConnectionDef[],
  options: {
    labelBias?: number;
    labelFontSize?: number;
    layered?: boolean;
    labelYOverrides?: (number | undefined)[];
  } = {},
): ArrowLayout[] {
  if (connections.length === 0) return [];

  const { labelBias = 0.3, labelFontSize = 16, layered = false, labelYOverrides } = options;

  // Pass 1: compute natural sides for each connection
  const sidePairs = connections.map(c => autoSides(c.startEl, c.endEl, { layered }));

  // Pass 2: group by (elementId, side) for starts and ends
  const startGroups = new Map<string, number[]>();
  const endGroups = new Map<string, number[]>();

  for (let i = 0; i < connections.length; i++) {
    const [ss, es] = sidePairs[i]!;
    const sk = `${connections[i]!.startEl.id}:${ss}`;
    if (!startGroups.has(sk)) startGroups.set(sk, []);
    startGroups.get(sk)!.push(i);

    const ek = `${connections[i]!.endEl.id}:${es}`;
    if (!endGroups.has(ek)) endGroups.set(ek, []);
    endGroups.get(ek)!.push(i);
  }

  // Pass 3: sort by target/source position and assign distributed fixedPoints
  const startFixeds: ([number, number] | undefined)[] = new Array(connections.length);
  const endFixeds: ([number, number] | undefined)[] = new Array(connections.length);

  for (const [key, indices] of startGroups) {
    if (indices.length <= 1) continue;
    const side = key.split(':')[1] as Side;
    // Sort by target position to minimize arrow crossings
    if (side === 'top' || side === 'bottom') {
      indices.sort((a, b) => center(connections[a]!.endEl)[0] - center(connections[b]!.endEl)[0]);
    } else {
      indices.sort((a, b) => center(connections[a]!.endEl)[1] - center(connections[b]!.endEl)[1]);
    }
    indices.forEach((idx, i) => {
      startFixeds[idx] = distributeFixedPoints(indices.length, side, i);
    });
  }

  for (const [key, indices] of endGroups) {
    if (indices.length <= 1) continue;
    const side = key.split(':')[1] as Side;
    if (side === 'top' || side === 'bottom') {
      indices.sort((a, b) => center(connections[a]!.startEl)[0] - center(connections[b]!.startEl)[0]);
    } else {
      indices.sort((a, b) => center(connections[a]!.startEl)[1] - center(connections[b]!.startEl)[1]);
    }
    indices.forEach((idx, i) => {
      endFixeds[idx] = distributeFixedPoints(indices.length, side, i);
    });
  }

  // Pass 4: compute arrow layouts with distributed fixedPoints
  return connections.map((c, i) => {
    return computeArrowLayout(c.startEl, c.endEl, {
      startSide: sidePairs[i]![0],
      endSide: sidePairs[i]![1],
      label: c.label,
      labelFontSize,
      labelBias,
      startFixedOverride: startFixeds[i],
      endFixedOverride: endFixeds[i],
      labelYOverride: labelYOverrides?.[i],
    });
  });
}
