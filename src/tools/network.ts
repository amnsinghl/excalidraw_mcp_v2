/**
 * Network topology diagram tool.
 * Ported from excalidraw-mcp tools/network.py
 */

import { getColor } from '../layout/style.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createArrow, createTitle, linkArrowsToShapes } from './helpers.js';

const NODE_GAP = 250;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

const NODE_TYPES: Record<string, { shape: 'rectangle' | 'ellipse' | 'diamond'; defaultColor: string }> = {
  server:       { shape: 'rectangle', defaultColor: 'blue' },
  database:     { shape: 'rectangle', defaultColor: 'green' },
  client:       { shape: 'ellipse',   defaultColor: 'gray' },
  loadbalancer: { shape: 'diamond',   defaultColor: 'orange' },
  firewall:     { shape: 'rectangle', defaultColor: 'red' },
  cloud:        { shape: 'ellipse',   defaultColor: 'purple' },
  router:       { shape: 'diamond',   defaultColor: 'yellow' },
  default:      { shape: 'rectangle', defaultColor: 'blue' },
};

export interface NetworkInput {
  nodes: Array<{
    label: string;
    type?: string;
    color?: string;
  }>;
  links?: Array<{
    from: string;
    to: string;
    label?: string;
    style?: string;
    bidirectional?: boolean;
  }>;
  title?: string;
}

export function createNetworkElements(input: NetworkInput): ServerElement[] {
  const { nodes, links = [], title } = input;

  const allElements: ServerElement[] = [];
  const nodeShapes = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();

  // Grid layout
  const cols = Math.max(3, Math.ceil(Math.sqrt(nodes.length)) + 1);

  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx]!;
    const nodeType = NODE_TYPES[node.type || 'default'] || NODE_TYPES.default!;
    const colorName = node.color || nodeType.defaultColor;
    const color = getColor(colorName);

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = col * NODE_GAP;
    const y = row * (NODE_HEIGHT + 80);

    const shapeId = generateId();
    const elems = createShape(x, y, NODE_WIDTH, NODE_HEIGHT, {
      id: shapeId,
      type: nodeType.shape,
      label: node.label,
      bgColor: color.bg,
      strokeColor: color.stroke,
      fontSize: 14,
    });
    allElements.push(...elems);
    nodeShapes.set(node.label, { id: shapeId, x, y, width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Links
  for (const link of links) {
    const fromShape = nodeShapes.get(link.from);
    const toShape = nodeShapes.get(link.to);
    if (fromShape && toShape) {
      const arrowElems = createArrow(fromShape, toShape, {
        label: link.label,
        strokeStyle: link.style || 'solid',
        startArrowhead: link.bidirectional ? 'arrow' : null,
      });
      allElements.push(...arrowElems);
    }
  }

  if (title) {
    allElements.unshift(createTitle(title, allElements));
  }

  linkArrowsToShapes(allElements);
  return allElements;
}
