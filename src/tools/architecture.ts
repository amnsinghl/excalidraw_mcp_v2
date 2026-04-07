/**
 * Architecture diagram tool — creates layered architecture diagrams.
 * Ported from excalidraw-mcp tools/architecture.py
 */

import { layeredLayout, type LayerDef } from '../layout/grid.js';
import { getColor } from '../layout/style.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createDistributedArrows, createTitle, linkArrowsToShapes } from './helpers.js';

export interface ArchitectureInput {
  layers: Array<{
    name: string;
    color?: string;
    components: Array<{
      label: string;
      color?: string;
    }>;
  }>;
  connections?: Array<{
    from: string;
    to: string;
    label?: string;
    style?: string;
  }>;
  title?: string;
}

export function createArchitectureElements(input: ArchitectureInput): ServerElement[] {
  const { layers, connections = [], title } = input;

  // Prepare layers with colors
  const layerDefs: LayerDef[] = layers.map(layer => {
    const layerColor = getColor(layer.color || 'blue');
    return {
      name: layer.name,
      color: layer.color,
      components: layer.components.map(comp => {
        const c = getColor(comp.color || layer.color || 'blue');
        return {
          label: comp.label,
          bg: c.bg,
          stroke: c.stroke,
        };
      }),
    };
  });

  const laidOut = layeredLayout(layerDefs, { connections });

  const allElements: ServerElement[] = [];
  const shapeMap = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();

  for (const item of laidOut) {
    const shapeId = generateId();
    const elems = createShape(item.x, item.y, item.width, item.height, {
      id: shapeId,
      label: item.label,
      bgColor: item.bg || '#a5d8ff',
      strokeColor: item.stroke || '#1971c2',
    });
    allElements.push(...elems);
    shapeMap.set(item.label, { id: shapeId, x: item.x, y: item.y, width: item.width, height: item.height });
  }

  // Connections — batch through distributed layout to prevent bundling
  // Compute label Y positions: place each label in the gap just below its source box
  const LABEL_GAP_OFFSET = 35; // px below source box bottom
  const validConns = connections
    .map(conn => {
      const startEl = shapeMap.get(conn.from);
      const endEl = shapeMap.get(conn.to);
      if (!startEl || !endEl) return null;
      return { startEl, endEl, label: conn.label, strokeStyle: conn.style || 'solid' };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const labelYOverrides = validConns.map(c => {
    // Place label in the gap just below the source box
    return c.startEl.y + c.startEl.height + LABEL_GAP_OFFSET;
  });

  allElements.push(...createDistributedArrows(validConns, { labelBias: 0.25, layered: true, labelYOverrides }));

  if (title) {
    allElements.unshift(createTitle(title, allElements));
  }

  linkArrowsToShapes(allElements);
  return allElements;
}
