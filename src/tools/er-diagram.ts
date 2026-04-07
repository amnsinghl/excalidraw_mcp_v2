/**
 * Entity-Relationship diagram tool.
 * Ported from excalidraw-mcp tools/er_diagram.py
 */

import { estimateTextWidth } from '../layout/text.js';
import { getColor } from '../layout/style.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createArrow, createTitle, linkArrowsToShapes } from './helpers.js';

const ENTITY_GAP = 300;
const HEADER_HEIGHT = 40;
const ATTR_HEIGHT = 28;
const ATTR_FONT_SIZE = 14;
const HEADER_FONT_SIZE = 16;
const MIN_ENTITY_WIDTH = 180;
const ENTITY_PADDING = 30;

export interface ERInput {
  entities: Array<{
    name: string;
    attributes?: string[];
    color?: string;
  }>;
  relationships?: Array<{
    from: string;
    to: string;
    label?: string;
    fromCardinality?: string;
    toCardinality?: string;
  }>;
  title?: string;
}

export function createERElements(input: ERInput): ServerElement[] {
  const { entities, relationships = [], title } = input;

  const allElements: ServerElement[] = [];
  const entityShapes = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();

  let currentX = 0;
  for (const ent of entities) {
    const attrs = ent.attributes || [];
    const color = getColor(ent.color || 'blue');

    // Width based on longest text
    const allTexts = [ent.name, ...attrs];
    const maxTextWidth = Math.max(...allTexts.map(t => estimateTextWidth(t!, HEADER_FONT_SIZE)));
    const entityWidth = Math.max(maxTextWidth + ENTITY_PADDING * 2, MIN_ENTITY_WIDTH);
    const entityTotalHeight = HEADER_HEIGHT + attrs.length * ATTR_HEIGHT;

    // Header rectangle
    const headerId = generateId();
    const headerElems = createShape(currentX, 0, entityWidth, HEADER_HEIGHT, {
      id: headerId,
      label: ent.name,
      bgColor: color.bg,
      strokeColor: color.stroke,
      fontSize: HEADER_FONT_SIZE,
    });
    allElements.push(...headerElems);

    // Body (white background with attributes)
    if (attrs.length > 0) {
      const bodyHeight = attrs.length * ATTR_HEIGHT;
      const bodyElems = createShape(currentX, HEADER_HEIGHT, entityWidth, bodyHeight, {
        bgColor: '#ffffff',
        strokeColor: color.stroke,
        strokeWidth: 1,
        roundness: null,
      });
      allElements.push(...bodyElems);

      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]!;
        const attrText: ServerElement = {
          id: generateId(),
          type: 'text',
          x: currentX + 10,
          y: HEADER_HEIGHT + i * ATTR_HEIGHT + (ATTR_HEIGHT - ATTR_FONT_SIZE * 1.4) / 2,
          width: estimateTextWidth(attr, ATTR_FONT_SIZE),
          height: ATTR_FONT_SIZE * 1.4,
          text: attr,
          originalText: attr,
          fontSize: ATTR_FONT_SIZE,
          fontFamily: 1,
          strokeColor: '#1e1e1e',
        };
        allElements.push(attrText);
      }
    }

    // Store full entity bounding box for arrows
    entityShapes.set(ent.name, {
      id: headerId,
      x: currentX,
      y: 0,
      width: entityWidth,
      height: entityTotalHeight || HEADER_HEIGHT,
    });

    currentX += entityWidth + ENTITY_GAP;
  }

  // Relationships
  for (const rel of relationships) {
    const fromShape = entityShapes.get(rel.from);
    const toShape = entityShapes.get(rel.to);
    if (fromShape && toShape) {
      let fullLabel = rel.label || '';
      if (rel.fromCardinality || rel.toCardinality) {
        const parts: string[] = [];
        if (rel.fromCardinality) parts.push(rel.fromCardinality);
        parts.push(fullLabel || '—');
        if (rel.toCardinality) parts.push(rel.toCardinality);
        fullLabel = parts.join(' ');
      }

      const arrowElems = createArrow(fromShape, toShape, {
        label: fullLabel || undefined,
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
