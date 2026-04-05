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
  } = {},
): PositionedLayerNode[] {
  const {
    layerGap = 120,
    componentGap = 40,
    boxHeight = DEFAULT_BOX_HEIGHT,
  } = options;

  const result: PositionedLayerNode[] = [];
  let currentY = 0;

  for (const layer of layers) {
    const components = layer.components || [];
    if (components.length === 0) continue;

    // Compute component widths
    const compWidths = components.map(comp => {
      if (comp.width) return comp.width;
      const tw = estimateTextWidth(comp.label || '', 20);
      return Math.max(tw + 60, 200);
    });

    // Lay out components horizontally
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
