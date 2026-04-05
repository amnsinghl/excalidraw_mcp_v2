/**
 * Flowchart tool — creates flowcharts with Sugiyama hierarchical auto-layout.
 * Ported from excalidraw-mcp tools/flowchart.py
 */

import { sugiyamaLayout, type SugiyamaNode, type SugiyamaEdge, type Direction } from '../layout/sugiyama.js';
import { getColor } from '../layout/style.js';
import { computeGroupFrame } from '../layout/groups.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createArrow, createTitle } from './helpers.js';

export interface FlowchartInput {
  nodes: Array<{
    label: string;
    color?: string;
    shape?: 'rectangle' | 'diamond' | 'ellipse';
    group?: string;
    description?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    style?: string;
    bidirectional?: boolean;
  }>;
  direction?: Direction;
  title?: string;
}

export function createFlowchartElements(input: FlowchartInput): ServerElement[] {
  const { nodes, edges, direction = 'LR', title } = input;

  // 1. Prepare node data with colors
  const nodeData: SugiyamaNode[] = nodes.map(node => {
    const color = getColor(node.color || 'blue');
    const displayLabel = node.description ? `${node.label}\n${node.description}` : node.label;
    return {
      label: displayLabel,
      _originalLabel: node.label,
      color: node.color || 'blue',
      shape: node.shape || 'rectangle',
      group: node.group,
      bg: color.bg,
      stroke: color.stroke,
    };
  });

  // 2. Build edge data for layout
  const edgeData: SugiyamaEdge[] = edges.map(e => ({
    from: e.from,
    to: e.to,
  }));

  // 3. Run Sugiyama layout
  const laidOut = sugiyamaLayout(nodeData, edgeData, direction);

  // 4. Generate elements
  const allElements: ServerElement[] = [];
  const shapeMap = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();
  const groupBounds = new Map<string, Array<{ x: number; y: number; width: number; height: number }>>();

  for (let idx = 0; idx < laidOut.length; idx++) {
    const item = laidOut[idx]!;
    const shapeType = (item.shape as 'rectangle' | 'diamond' | 'ellipse') || 'rectangle';
    const shapeId = generateId();

    const elems = createShape(item.x, item.y, item.width, item.height, {
      id: shapeId,
      type: shapeType,
      label: item.label,
      bgColor: item.bg,
      strokeColor: item.stroke,
    });
    allElements.push(...elems);

    const bbox = { id: shapeId, x: item.x, y: item.y, width: item.width, height: item.height };
    shapeMap.set(item.label, bbox);
    shapeMap.set(String(idx), bbox);
    if (item._originalLabel && item._originalLabel !== item.label) {
      shapeMap.set(item._originalLabel, bbox);
    }

    if (item.group) {
      const bounds = groupBounds.get(item.group) || [];
      bounds.push({ x: item.x, y: item.y, width: item.width, height: item.height });
      groupBounds.set(item.group, bounds);
    }
  }

  // 5. Add group frames
  for (const [groupName, bounds] of groupBounds) {
    const frame = computeGroupFrame(groupName, bounds);
    if (frame) {
      const color = getColor('gray');
      const frameElems = createShape(frame.x, frame.y, frame.width, frame.height, {
        type: 'rectangle',
        bgColor: 'transparent',
        strokeColor: color.stroke,
        strokeStyle: 'dashed',
        strokeWidth: 1,
        roughness: 0,
        opacity: 60,
        roundness: null,
      });
      // Label for group
      const labelEl: ServerElement = {
        id: generateId(),
        type: 'text',
        x: frame.labelX,
        y: frame.labelY,
        width: 100,
        height: 22,
        text: groupName,
        originalText: groupName,
        fontSize: 16,
        fontFamily: 1,
        strokeColor: color.stroke,
        opacity: 70,
      };
      // Frames go behind other elements
      allElements.unshift(...frameElems, labelEl);
    }
  }

  // 6. Generate arrows
  for (const edge of edges) {
    const startEl = shapeMap.get(edge.from);
    const endEl = shapeMap.get(edge.to);
    if (startEl && endEl) {
      const arrowElems = createArrow(startEl, endEl, {
        label: edge.label,
        strokeStyle: edge.style || 'solid',
        startArrowhead: edge.bidirectional ? 'arrow' : null,
      });
      allElements.push(...arrowElems);
    }
  }

  // 7. Add title
  if (title) {
    allElements.unshift(createTitle(title, allElements));
  }

  return allElements;
}
