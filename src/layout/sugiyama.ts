/**
 * Sugiyama hierarchical layout using dagre.
 * Ported from excalidraw-mcp layout/sugiyama.py
 *
 * Handles branches, merges, cycles, disconnected subgraphs,
 * and LR/RL/TB/BT directions.
 */

import dagre from '@dagrejs/dagre';
import { estimateTextWidth, BOX_PADDING, MIN_BOX_WIDTH, DEFAULT_BOX_HEIGHT, DEFAULT_FONT_SIZE } from './text.js';

export type Direction = 'LR' | 'RL' | 'TB' | 'BT';

export interface SugiyamaNode {
  label: string;
  width?: number;
  color?: string;
  bg?: string;
  stroke?: string;
  shape?: string;
  group?: string;
  description?: string;
  [key: string]: any;
}

export interface SugiyamaEdge {
  from: string;
  to: string;
  label?: string;
  style?: string;
  bidirectional?: boolean;
}

export interface PositionedNode extends SugiyamaNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Layout tuning defaults
const SIBLING_GAP = 60;
const LAYER_GAP = 100;

export function sugiyamaLayout(
  nodes: SugiyamaNode[],
  edges: SugiyamaEdge[],
  direction: Direction = 'LR',
  siblingGap: number = SIBLING_GAP,
  layerGap: number = LAYER_GAP,
  boxHeight: number = DEFAULT_BOX_HEIGHT,
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const validDirs = new Set<string>(['LR', 'RL', 'TB', 'BT']);
  const dirUpper = direction.toUpperCase();
  if (!validDirs.has(dirUpper)) {
    throw new Error(`Invalid direction '${direction}'. Must be one of: LR, RL, TB, BT`);
  }

  // 1. Calculate node dimensions
  const nodeWidths: number[] = nodes.map(node => {
    if (node.width) return node.width;
    const tw = estimateTextWidth(node.label || '', DEFAULT_FONT_SIZE);
    return Math.max(tw + BOX_PADDING, MIN_BOX_WIDTH);
  });

  // 2. Build dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: dirUpper as 'LR' | 'RL' | 'TB' | 'BT',
    nodesep: siblingGap,
    ranksep: layerGap,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Build lookup: label → index, index → label
  const labelToIndex = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const label = node.label || String(i);
    const nodeId = String(i);
    labelToIndex.set(label, i);
    g.setNode(nodeId, {
      width: nodeWidths[i]!,
      height: boxHeight,
      label,
    });
  }

  // Resolve a node reference (by label first, then by index)
  function resolveIndex(key: string): number | null {
    if (labelToIndex.has(key)) return labelToIndex.get(key)!;
    const idx = parseInt(key, 10);
    if (!isNaN(idx) && idx >= 0 && idx < nodes.length) return idx;
    return null;
  }

  for (const edge of edges) {
    const fromIdx = resolveIndex(edge.from);
    const toIdx = resolveIndex(edge.to);
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      g.setEdge(String(fromIdx), String(toIdx));
    }
  }

  // 3. Run dagre layout
  dagre.layout(g);

  // 4. Extract positions and build result
  const result: PositionedNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const dagreNode = g.node(String(i));
    const w = nodeWidths[i]!;
    const nodeCopy: PositionedNode = {
      ...nodes[i]!,
      // dagre gives center coordinates; convert to top-left
      x: dagreNode.x - w / 2,
      y: dagreNode.y - boxHeight / 2,
      width: w,
      height: boxHeight,
    };
    result.push(nodeCopy);
  }

  // 5. Normalize: shift so min x/y = 0
  if (result.length > 0) {
    const minX = Math.min(...result.map(n => n.x));
    const minY = Math.min(...result.map(n => n.y));
    for (const n of result) {
      n.x -= minX;
      n.y -= minY;
    }
  }

  return result;
}
