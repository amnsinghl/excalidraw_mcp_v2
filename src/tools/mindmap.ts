/**
 * Mind map tool — creates horizontal tree-style mind maps.
 * Ported from excalidraw-mcp tools/mindmap.py
 */

import { mindmapLayout, type TreeNode } from '../layout/tree.js';
import { getColor } from '../layout/style.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createArrow, createTitle } from './helpers.js';

export interface MindmapInput {
  root: TreeNode;
  title?: string;
}

export function createMindmapElements(input: MindmapInput): ServerElement[] {
  const { root, title } = input;

  const laidOut = mindmapLayout(root);

  const allElements: ServerElement[] = [];
  const shapeMap = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();

  for (const node of laidOut) {
    const color = getColor(node.color || 'blue');
    const shapeId = generateId();
    const shapeType = (node.shape as 'ellipse' | 'rectangle') || 'rectangle';

    const elems = createShape(node.x, node.y, node.width, node.height, {
      id: shapeId,
      type: shapeType,
      label: node.label,
      bgColor: color.bg,
      strokeColor: color.stroke,
      fontSize: node.level === 0 ? 18 : 16,
    });
    allElements.push(...elems);
    shapeMap.set(node.label, { id: shapeId, x: node.x, y: node.y, width: node.width, height: node.height });
  }

  // Connect parent → child
  for (const node of laidOut) {
    if (node.parentLabel) {
      const parentBbox = shapeMap.get(node.parentLabel);
      const childBbox = shapeMap.get(node.label);
      if (parentBbox && childBbox) {
        const arrowElems = createArrow(parentBbox, childBbox, {
          strokeWidth: 1,
          endArrowhead: 'arrow',
        });
        allElements.push(...arrowElems);
      }
    }
  }

  if (title) {
    allElements.unshift(createTitle(title, allElements));
  }

  return allElements;
}
