/**
 * Shared utilities for diagram tools.
 * Converts layout-computed positions into ServerElement arrays.
 */

import { generateId, type ServerElement } from '../types.js';
import { getColor, type ColorPair } from '../layout/style.js';
import { estimateTextWidth } from '../layout/text.js';
import { computeArrowLayout, type BoundingBox, type Side } from '../layout/arrows.js';

export function createShape(
  x: number, y: number, width: number, height: number,
  options: {
    id?: string;
    type?: 'rectangle' | 'ellipse' | 'diamond';
    label?: string;
    bgColor?: string;
    strokeColor?: string;
    fontSize?: number;
    strokeStyle?: string;
    strokeWidth?: number;
    roughness?: number;
    opacity?: number;
    roundness?: { type: number } | null;
  } = {},
): ServerElement[] {
  const {
    id = generateId(),
    type = 'rectangle',
    label,
    bgColor = '#a5d8ff',
    strokeColor = '#1971c2',
    fontSize = 20,
    strokeStyle = 'solid',
    strokeWidth = 2,
    roughness = 1,
    opacity = 100,
    roundness = { type: 3 },
  } = options;

  const shape: ServerElement = {
    id,
    type,
    x, y, width, height,
    backgroundColor: bgColor,
    strokeColor,
    strokeWidth,
    strokeStyle,
    roughness,
    opacity,
    roundness,
    boundElements: [],
  };

  const elements: ServerElement[] = [shape];

  if (label) {
    const textId = generateId();
    const textEl: ServerElement = {
      id: textId,
      type: 'text',
      x: x,
      y: y,
      width: estimateTextWidth(label, fontSize),
      height: fontSize * 1.4,
      text: label,
      originalText: label,
      fontSize,
      fontFamily: 1,
      strokeColor: '#1e1e1e',
      containerId: id,
    };
    (shape.boundElements as any[]).push({ id: textId, type: 'text' });
    shape.label = { text: label };
    elements.push(textEl);
  }

  return elements;
}

export function createArrow(
  startEl: BoundingBox,
  endEl: BoundingBox,
  options: {
    id?: string;
    label?: string;
    strokeStyle?: string;
    strokeWidth?: number;
    startArrowhead?: string | null;
    endArrowhead?: string | null;
    elbowed?: boolean;
    startSide?: Side | 'auto';
    endSide?: Side | 'auto';
  } = {},
): ServerElement[] {
  const {
    id = generateId(),
    label,
    strokeStyle = 'solid',
    strokeWidth = 2,
    startArrowhead = null,
    endArrowhead = 'arrow',
    elbowed = false,
    startSide = 'auto',
    endSide = 'auto',
  } = options;

  const layout = computeArrowLayout(startEl, endEl, {
    startSide,
    endSide,
    elbowed,
    label,
    labelFontSize: 16,
  });

  const arrow: ServerElement = {
    id,
    type: 'arrow',
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    strokeColor: '#1e1e1e',
    strokeWidth,
    strokeStyle,
    roughness: 1,
    opacity: 100,
    points: layout.points,
    startArrowhead,
    endArrowhead,
    startBinding: {
      elementId: layout.startElementId,
      fixedPoint: layout.startFixed,
      focus: 0,
      gap: 0,
    },
    endBinding: {
      elementId: layout.endElementId,
      fixedPoint: layout.endFixed,
      focus: 0,
      gap: 0,
    },
    roundness: { type: 2 },
    boundElements: [],
  };

  const elements: ServerElement[] = [arrow];

  // Create label text if provided
  if (label && layout.labelX !== undefined) {
    const textId = id + '_label';
    const textEl: ServerElement = {
      id: textId,
      type: 'text',
      x: layout.labelX,
      y: layout.labelY!,
      width: layout.labelWidth,
      height: layout.labelHeight,
      text: label,
      originalText: label,
      fontSize: 16,
      fontFamily: 1,
      strokeColor: '#1e1e1e',
      containerId: id,
    };
    (arrow.boundElements as any[]).push({ id: textId, type: 'text' });
    elements.push(textEl);
  }

  return elements;
}

export function createTitle(title: string, allElements: ServerElement[], fontSize: number = 28): ServerElement {
  // Find bounding box of all elements
  const xs = allElements.filter(e => e.x !== undefined).map(e => e.x);
  const widths = allElements.filter(e => e.width !== undefined).map(e => e.x + (e.width || 0));

  const minX = xs.length > 0 ? Math.min(...xs) : 0;
  const maxX = widths.length > 0 ? Math.max(...widths) : 400;
  const minY = allElements.filter(e => e.y !== undefined).length > 0
    ? Math.min(...allElements.filter(e => e.y !== undefined).map(e => e.y))
    : 0;

  const textWidth = estimateTextWidth(title, fontSize);
  const centerX = minX + (maxX - minX) / 2;

  return {
    id: generateId(),
    type: 'text',
    x: centerX - textWidth / 2,
    y: minY - fontSize * 2,
    width: textWidth,
    height: fontSize * 1.4,
    text: title,
    originalText: title,
    fontSize,
    fontFamily: 1,
    strokeColor: '#1e1e1e',
  };
}
