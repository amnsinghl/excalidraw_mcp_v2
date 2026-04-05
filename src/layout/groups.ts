/**
 * Group frame layout — computes bounding rectangles around groups of nodes.
 * Ported from excalidraw-mcp elements/groups.py
 */

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupFrameLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  labelX: number;
  labelY: number;
  name: string;
}

const GROUP_PADDING = 30;
const LABEL_HEIGHT = 30;

export function computeGroupFrame(
  name: string,
  nodeBounds: NodeBounds[],
  padding: number = GROUP_PADDING,
  labelHeight: number = LABEL_HEIGHT,
): GroupFrameLayout | null {
  if (nodeBounds.length === 0) return null;

  const minX = Math.min(...nodeBounds.map(b => b.x));
  const minY = Math.min(...nodeBounds.map(b => b.y));
  const maxX = Math.max(...nodeBounds.map(b => b.x + b.width));
  const maxY = Math.max(...nodeBounds.map(b => b.y + b.height));

  return {
    x: minX - padding,
    y: minY - padding - labelHeight,
    width: (maxX - minX) + 2 * padding,
    height: (maxY - minY) + 2 * padding + labelHeight,
    labelX: minX - padding + 10,
    labelY: minY - padding - labelHeight + 8,
    name,
  };
}
