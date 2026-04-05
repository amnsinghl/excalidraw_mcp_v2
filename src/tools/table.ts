/**
 * Table diagram tool — creates grid-based tables.
 * Ported from excalidraw-mcp tools/table.py
 */

import { estimateTextWidth } from '../layout/text.js';
import { getColor } from '../layout/style.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createTitle } from './helpers.js';

const CELL_PADDING = 15;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 42;
const MIN_COL_WIDTH = 100;
const FONT_SIZE = 14;
const HEADER_FONT_SIZE = 15;

export interface TableInput {
  headers: string[];
  rows: string[][];
  title?: string;
  headerColor?: string;
}

export function createTableElements(input: TableInput): ServerElement[] {
  const { headers, rows, title, headerColor = 'blue' } = input;

  const allElements: ServerElement[] = [];
  const numCols = headers.length;
  const color = getColor(headerColor);

  // Calculate column widths based on content
  const colWidths: number[] = [];
  for (let col = 0; col < numCols; col++) {
    let maxWidth = estimateTextWidth(headers[col]!, HEADER_FONT_SIZE) + CELL_PADDING * 2;
    for (const row of rows) {
      if (col < row.length) {
        const cellWidth = estimateTextWidth(row[col]!, FONT_SIZE) + CELL_PADDING * 2;
        maxWidth = Math.max(maxWidth, cellWidth);
      }
    }
    colWidths.push(Math.max(maxWidth, MIN_COL_WIDTH));
  }

  // Header row
  let x = 0;
  for (let col = 0; col < numCols; col++) {
    const cw = colWidths[col]!;
    const headerLabel = headers[col]!;
    const cellElems = createShape(x, 0, cw, HEADER_HEIGHT, {
      bgColor: color.bg,
      strokeColor: color.stroke,
      roundness: null,
    });
    allElements.push(...cellElems);

    const headerText: ServerElement = {
      id: generateId(),
      type: 'text',
      x: x + (cw - estimateTextWidth(headerLabel, HEADER_FONT_SIZE)) / 2,
      y: (HEADER_HEIGHT - HEADER_FONT_SIZE * 1.4) / 2,
      width: estimateTextWidth(headerLabel, HEADER_FONT_SIZE),
      height: HEADER_FONT_SIZE * 1.4,
      text: headerLabel,
      originalText: headerLabel,
      fontSize: HEADER_FONT_SIZE,
      fontFamily: 1,
      strokeColor: '#1e1e1e',
    };
    allElements.push(headerText);
    x += cw;
  }

  // Data rows
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]!;
    const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
    x = 0;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f8f9fa';

    for (let col = 0; col < numCols; col++) {
      const cw = colWidths[col]!;
      const cellText = col < row.length ? row[col]! : '';

      const cellElems = createShape(x, y, cw, ROW_HEIGHT, {
        bgColor: bg,
        strokeColor: '#dee2e6',
        strokeWidth: 1,
        roundness: null,
      });
      allElements.push(...cellElems);

      if (cellText) {
        const textEl: ServerElement = {
          id: generateId(),
          type: 'text',
          x: x + (cw - estimateTextWidth(cellText, FONT_SIZE)) / 2,
          y: y + (ROW_HEIGHT - FONT_SIZE * 1.4) / 2,
          width: estimateTextWidth(cellText, FONT_SIZE),
          height: FONT_SIZE * 1.4,
          text: cellText,
          originalText: cellText,
          fontSize: FONT_SIZE,
          fontFamily: 1,
          strokeColor: '#1e1e1e',
        };
        allElements.push(textEl);
      }
      x += cw;
    }
  }

  if (title) {
    allElements.unshift(createTitle(title, allElements));
  }

  return allElements;
}
