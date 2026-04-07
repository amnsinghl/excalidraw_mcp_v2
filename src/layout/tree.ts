/**
 * Tree layout algorithms for org charts and mind maps.
 * Ported from excalidraw-mcp tools/org_chart.py and tools/mindmap.py
 */

import { estimateTextWidth } from './text.js';

// --- Org chart (top-down tree) ---

export interface TreeNode {
  label: string;
  children?: TreeNode[];
  color?: string;
  description?: string;
  [key: string]: any;
}

export interface PositionedTreeNode {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  color?: string;
  description?: string;
  parentLabel?: string;
  _subtreeWidth?: number;
  [key: string]: any;
}

// Org chart constants
const ORG_LEVEL_GAP = 100;
const ORG_SIBLING_GAP = 30;
const ORG_NODE_WIDTH = 160;
const ORG_NODE_HEIGHT = 50;

function calcSubtreeWidth(node: TreeNode): number {
  const children = node.children || [];
  if (children.length === 0) {
    (node as any)._width = ORG_NODE_WIDTH;
    return ORG_NODE_WIDTH;
  }
  let total = 0;
  for (const child of children) {
    total += calcSubtreeWidth(child);
  }
  total += ORG_SIBLING_GAP * (children.length - 1);
  (node as any)._width = Math.max(total, ORG_NODE_WIDTH);
  return (node as any)._width;
}

function layoutOrgNode(
  node: TreeNode,
  x: number,
  y: number,
  level: number,
  result: PositionedTreeNode[],
  parentLabel?: string,
): void {
  const subtreeW = (node as any)._width || ORG_NODE_WIDTH;
  const nodeX = x + subtreeW / 2 - ORG_NODE_WIDTH / 2;

  result.push({
    label: node.label,
    x: nodeX,
    y,
    width: ORG_NODE_WIDTH,
    height: ORG_NODE_HEIGHT,
    level,
    color: node.color,
    description: node.description,
    parentLabel,
  });

  const children = node.children || [];
  if (children.length > 0) {
    const childY = y + ORG_NODE_HEIGHT + ORG_LEVEL_GAP;
    let childX = x;
    for (const child of children) {
      layoutOrgNode(child, childX, childY, level + 1, result, node.label);
      childX += ((child as any)._width || ORG_NODE_WIDTH) + ORG_SIBLING_GAP;
    }
  }
}

export function orgChartLayout(root: TreeNode): PositionedTreeNode[] {
  calcSubtreeWidth(root);
  const result: PositionedTreeNode[] = [];
  layoutOrgNode(root, 0, 0, 0, result);

  // Normalize so min x = 0
  if (result.length > 0) {
    const minX = Math.min(...result.map(n => n.x));
    for (const n of result) {
      n.x -= minX;
    }
  }

  return result;
}

// --- Mind map (left-to-right radial tree) ---

const MIND_LEVEL_GAP = 250;
const MIND_SIBLING_GAP = 30;
const MIND_NODE_HEIGHT = 50;
const BRANCH_COLORS = ['blue', 'green', 'purple', 'orange', 'red', 'pink', 'yellow'];

function calcSubtreeSize(node: TreeNode): number {
  const children = node.children || [];
  if (children.length === 0) {
    (node as any)._height = MIND_NODE_HEIGHT;
    return MIND_NODE_HEIGHT;
  }
  let total = 0;
  for (const child of children) {
    total += calcSubtreeSize(child);
  }
  total += MIND_SIBLING_GAP * (children.length - 1);
  (node as any)._height = Math.max(total, MIND_NODE_HEIGHT);
  return (node as any)._height;
}

function layoutMindNode(
  node: TreeNode,
  x: number,
  y: number,
  level: number,
  branchColorIdx: number | null,
  result: PositionedTreeNode[],
  parentLabel?: string,
): void {
  const textWidth = estimateTextWidth(node.label, level === 0 ? 18 : 16);
  const nodeWidth = Math.max(textWidth + 40, level === 0 ? 160 : 120);

  const colorName = level === 0
    ? 'gray'
    : branchColorIdx !== null
      ? BRANCH_COLORS[branchColorIdx % BRANCH_COLORS.length]
      : 'blue';

  result.push({
    label: node.label,
    x,
    y,
    width: nodeWidth,
    height: MIND_NODE_HEIGHT,
    level,
    color: colorName,
    shape: level === 0 ? 'ellipse' : 'rectangle',
    parentLabel,
  });

  const children = node.children || [];
  if (children.length > 0) {
    const totalHeight = (node as any)._height || MIND_NODE_HEIGHT;
    let childYStart = y + MIND_NODE_HEIGHT / 2 - totalHeight / 2;
    const childX = x + nodeWidth + MIND_LEVEL_GAP;

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const childHeight = (child as any)._height || MIND_NODE_HEIGHT;
      const childCenterY = childYStart + childHeight / 2 - MIND_NODE_HEIGHT / 2;
      const childBranchIdx = level === 0 ? i : branchColorIdx;
      layoutMindNode(child, childX, childCenterY, level + 1, childBranchIdx, result, node.label);
      childYStart += childHeight + MIND_SIBLING_GAP;
    }
  }
}

export function mindmapLayout(root: TreeNode): PositionedTreeNode[] {
  calcSubtreeSize(root);
  const result: PositionedTreeNode[] = [];
  layoutMindNode(root, 0, 0, 0, null, result);

  // Normalize positions
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
