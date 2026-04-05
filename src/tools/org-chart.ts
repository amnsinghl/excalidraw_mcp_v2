/**
 * Org chart tool — creates top-down hierarchical org charts.
 * Ported from excalidraw-mcp tools/org_chart.py
 */

import { orgChartLayout, type TreeNode } from '../layout/tree.js';
import { getColor } from '../layout/style.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createArrow, createTitle } from './helpers.js';

export interface OrgChartInput {
  root: TreeNode;
  title?: string;
}

export function createOrgChartElements(input: OrgChartInput): ServerElement[] {
  const { root, title } = input;

  const laidOut = orgChartLayout(root);

  const allElements: ServerElement[] = [];
  const shapeMap = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();

  for (const node of laidOut) {
    const colorName = node.color || (node.level === 0 ? 'blue' : 'gray');
    const color = getColor(colorName);
    const shapeId = generateId();
    const displayLabel = node.description ? `${node.label}\n${node.description}` : node.label;

    const elems = createShape(node.x, node.y, node.width, node.height, {
      id: shapeId,
      label: displayLabel,
      bgColor: color.bg,
      strokeColor: color.stroke,
      fontSize: 14,
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
          endArrowhead: null,
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
