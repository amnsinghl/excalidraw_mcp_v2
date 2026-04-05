/**
 * Grid and layered layout algorithms.
 * Ported from excalidraw-mcp layout/grid.py
 */

import { estimateTextWidth, DEFAULT_BOX_HEIGHT } from './text.js';

export interface GridNode {
  label: string;
  width?: number;
  color?: string;
  bg?: string;
  stroke?: string;
  [key: string]: any;
}

export interface PositionedGridNode extends GridNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function gridLayout(
  nodes: GridNode[],
  options: {
    direction?: 'horizontal' | 'vertical';
    colGap?: number;
    rowGap?: number;
    boxHeight?: number;
    columns?: number;
  } = {},
): PositionedGridNode[] {
  const {
    direction = 'horizontal',
    colGap = 100,
    rowGap = 90,
    boxHeight = DEFAULT_BOX_HEIGHT,
    columns = 3,
  } = options;

  const n = nodes.length;
  if (n === 0) return [];

  // Calculate each node's box width
  const boxWidths = nodes.map(node => {
    if (node.width) return node.width;
    const tw = estimateTextWidth(node.label || '', 20);
    return Math.max(tw + 60, 200);
  });

  const result: PositionedGridNode[] = [];

  if (direction === 'horizontal') {
    const numCols = columns;
    const numRows = Math.ceil(n / numCols);

    // Per-column max width
    const colWidths: number[] = [];
    for (let col = 0; col < numCols; col++) {
      let maxW = 0;
      for (let row = 0; row < numRows; row++) {
        const idx = row * numCols + col;
        if (idx < n) maxW = Math.max(maxW, boxWidths[idx]!);
      }
      colWidths.push(maxW);
    }

    // Column x-starts
    const colXStarts: number[] = [];
    let cx = 0;
    for (let col = 0; col < numCols; col++) {
      colXStarts.push(cx);
      cx += colWidths[col]! + colGap;
    }

    for (let idx = 0; idx < n; idx++) {
      const row = Math.floor(idx / numCols);
      const col = idx % numCols;
      result.push({
        ...nodes[idx]!,
        x: colXStarts[col]!,
        y: row * (boxHeight + rowGap),
        width: boxWidths[idx]!,
        height: boxHeight,
      });
    }
  } else {
    // Vertical: column-major fill
    const numRows = Math.ceil(n / columns) || n;
    const numColsActual = Math.ceil(n / numRows);

    const colWidths: number[] = new Array(numColsActual).fill(0);
    for (let idx = 0; idx < n; idx++) {
      const col = Math.floor(idx / numRows);
      colWidths[col] = Math.max(colWidths[col]!, boxWidths[idx]!);
    }

    const colXStarts: number[] = [];
    let cx = 0;
    for (let col = 0; col < numColsActual; col++) {
      colXStarts.push(cx);
      cx += colWidths[col]! + colGap;
    }

    for (let idx = 0; idx < n; idx++) {
      const col = Math.floor(idx / numRows);
      const row = idx % numRows;
      result.push({
        ...nodes[idx]!,
        x: colXStarts[col]!,
        y: row * (boxHeight + rowGap),
        width: boxWidths[idx]!,
        height: boxHeight,
      });
    }
  }

  return result;
}

// --- Layered layout (for architecture diagrams) ---

export interface LayerDef {
  name: string;
  color?: string;
  components: GridNode[];
}

export interface PositionedLayerNode extends PositionedGridNode {
  layerName: string;
}

export function layeredLayout(
  layers: LayerDef[],
  options: {
    layerGap?: number;
    componentGap?: number;
    boxHeight?: number;
    connections?: Array<{ from: string; to: string }>;
  } = {},
): PositionedLayerNode[] {
  const {
    layerGap = 190,
    componentGap = 40,
    boxHeight = DEFAULT_BOX_HEIGHT,
    connections = [],
  } = options;

  // First pass: compute widths and initial order
  const layerData = layers.map(layer => {
    const components = layer.components || [];
    const compWidths = components.map(comp => {
      if (comp.width) return comp.width;
      const tw = estimateTextWidth(comp.label || '', 20);
      return Math.max(tw + 60, 200);
    });
    return { layer, components, compWidths };
  });

  // If connections are available, reorder components via barycenter heuristic
  if (connections.length > 0) {
    barycenterReorder(layerData, connections);
  }

  // Second pass: assign positions using final order
  const result: PositionedLayerNode[] = [];
  let currentY = 0;

  for (const { layer, components, compWidths } of layerData) {
    if (components.length === 0) continue;

    let currentX = 0;
    for (let i = 0; i < components.length; i++) {
      result.push({
        ...components[i]!,
        x: currentX,
        y: currentY,
        width: compWidths[i]!,
        height: boxHeight,
        layerName: layer.name,
      });
      currentX += compWidths[i]! + componentGap;
    }

    currentY += boxHeight + layerGap;
  }

  return result;
}

/**
 * Barycenter heuristic: reorder components within each layer to minimize
 * arrow crossings. Works by computing the average position of connected
 * nodes in adjacent layers, then sorting by that average.
 * Runs 2 passes: top-down then bottom-up.
 */
function barycenterReorder(
  layerData: Array<{
    layer: LayerDef;
    components: GridNode[];
    compWidths: number[];
  }>,
  connections: Array<{ from: string; to: string }>,
): void {
  // Build adjacency: label → set of connected labels
  const adj = new Map<string, Set<string>>();
  for (const conn of connections) {
    if (!adj.has(conn.from)) adj.set(conn.from, new Set());
    if (!adj.has(conn.to)) adj.set(conn.to, new Set());
    adj.get(conn.from)!.add(conn.to);
    adj.get(conn.to)!.add(conn.from);
  }

  // Helper: compute temporary x-center positions for current order in a layer
  function getPositions(ld: typeof layerData[0]): Map<string, number> {
    const positions = new Map<string, number>();
    let x = 0;
    for (let i = 0; i < ld.components.length; i++) {
      const cx = x + ld.compWidths[i]! / 2;
      positions.set(ld.components[i]!.label, cx);
      x += ld.compWidths[i]! + 40; // componentGap
    }
    return positions;
  }

  // Helper: reorder one layer using barycenter from an adjacent layer's positions
  function reorderLayer(
    target: typeof layerData[0],
    referencePositions: Map<string, number>,
  ): void {
    // Compute barycenter for each component
    const barycenters: Array<{ index: number; bc: number }> = [];
    for (let i = 0; i < target.components.length; i++) {
      const label = target.components[i]!.label;
      const neighbors = adj.get(label);
      if (!neighbors || neighbors.size === 0) {
        barycenters.push({ index: i, bc: Infinity }); // no connections → keep at end
        continue;
      }
      let sum = 0;
      let count = 0;
      for (const neighbor of neighbors) {
        const pos = referencePositions.get(neighbor);
        if (pos !== undefined) {
          sum += pos;
          count++;
        }
      }
      barycenters.push({ index: i, bc: count > 0 ? sum / count : Infinity });
    }

    // Sort by barycenter
    barycenters.sort((a, b) => a.bc - b.bc);

    // Apply new order
    const newComponents = barycenters.map(b => target.components[b.index]!);
    const newWidths = barycenters.map(b => target.compWidths[b.index]!);
    target.components.splice(0, target.components.length, ...newComponents);
    target.compWidths.splice(0, target.compWidths.length, ...newWidths);
  }

  // Top-down pass: use layer i's positions to reorder layer i+1
  for (let i = 0; i < layerData.length - 1; i++) {
    const refPositions = getPositions(layerData[i]!);
    reorderLayer(layerData[i + 1]!, refPositions);
  }

  // Bottom-up pass: use layer i's positions to reorder layer i-1
  for (let i = layerData.length - 1; i > 0; i--) {
    const refPositions = getPositions(layerData[i]!);
    reorderLayer(layerData[i - 1]!, refPositions);
  }
}
