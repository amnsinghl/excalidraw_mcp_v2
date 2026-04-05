/**
 * Sequence diagram tool — creates UML-style sequence diagrams.
 * Ported from excalidraw-mcp tools/sequence.py
 */

import { estimateTextWidth } from '../layout/text.js';
import { type ServerElement, generateId } from '../types.js';
import { createShape, createTitle } from './helpers.js';

const PARTICIPANT_GAP = 200;
const PARTICIPANT_WIDTH = 150;
const PARTICIPANT_HEIGHT = 50;
const MESSAGE_GAP = 60;
const LIFELINE_START_OFFSET = 30;
const FONT_SIZE = 16;
const SELF_LOOP_WIDTH = 40;

export interface SequenceInput {
  participants: string[];
  messages: Array<{
    from: string;
    to: string;
    label?: string;
    style?: string;
  }>;
  title?: string;
}

export function createSequenceElements(input: SequenceInput): ServerElement[] {
  const { participants, messages, title } = input;

  const allElements: ServerElement[] = [];
  const participantCenters = new Map<string, number>();

  // 1. Layout participants horizontally
  for (let idx = 0; idx < participants.length; idx++) {
    const name = participants[idx]!;
    const cx = idx * PARTICIPANT_GAP;
    participantCenters.set(name, cx);

    const pw = Math.max(estimateTextWidth(name, FONT_SIZE) + 40, PARTICIPANT_WIDTH);
    const px = cx - pw / 2;

    const elems = createShape(px, 0, pw, PARTICIPANT_HEIGHT, {
      label: name,
      bgColor: '#a5d8ff',
      strokeColor: '#1971c2',
      fontSize: FONT_SIZE,
    });
    allElements.push(...elems);
  }

  // 2. Lifeline length
  const lifelineLength = LIFELINE_START_OFFSET + messages.length * MESSAGE_GAP + 40;

  // 3. Draw lifelines (vertical dashed lines)
  for (const [, cx] of participantCenters) {
    const lineId = generateId();
    const line: ServerElement = {
      id: lineId,
      type: 'line',
      x: cx,
      y: PARTICIPANT_HEIGHT,
      width: 0,
      height: lifelineLength,
      strokeColor: '#868e96',
      strokeWidth: 1,
      strokeStyle: 'dashed',
      roughness: 0,
      opacity: 100,
      points: [[0, 0], [0, lifelineLength]],
    };
    allElements.push(line);
  }

  // 4. Draw messages (horizontal arrows)
  for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
    const msg = messages[msgIdx]!;
    const fromX = participantCenters.get(msg.from) ?? 0;
    const toX = participantCenters.get(msg.to) ?? 0;
    const msgY = PARTICIPANT_HEIGHT + LIFELINE_START_OFFSET + msgIdx * MESSAGE_GAP;

    if (msg.from === msg.to) {
      // Self-message loop
      const arrow: ServerElement = {
        id: generateId(),
        type: 'arrow',
        x: fromX,
        y: msgY,
        width: SELF_LOOP_WIDTH,
        height: MESSAGE_GAP * 0.6,
        strokeColor: '#1e1e1e',
        strokeWidth: 2,
        strokeStyle: msg.style || 'solid',
        roughness: 0,
        opacity: 100,
        roundness: { type: 2 },
        points: [
          [0, 0],
          [SELF_LOOP_WIDTH, 0],
          [SELF_LOOP_WIDTH, MESSAGE_GAP * 0.6],
          [0, MESSAGE_GAP * 0.6],
        ],
        endArrowhead: 'arrow',
      };
      allElements.push(arrow);
    } else {
      const dx = toX - fromX;
      const arrow: ServerElement = {
        id: generateId(),
        type: 'arrow',
        x: fromX,
        y: msgY,
        width: Math.abs(dx),
        height: 0,
        strokeColor: '#1e1e1e',
        strokeWidth: 2,
        strokeStyle: msg.style || 'solid',
        roughness: 0,
        opacity: 100,
        roundness: { type: 2 },
        points: [[0, 0], [dx, 0]],
        endArrowhead: 'arrow',
      };
      allElements.push(arrow);
    }

    // Message label
    if (msg.label) {
      const labelWidth = estimateTextWidth(msg.label, 14);
      const midX = (fromX + toX) / 2;
      const labelEl: ServerElement = {
        id: generateId(),
        type: 'text',
        x: midX - labelWidth / 2,
        y: msgY - 18,
        width: labelWidth,
        height: 14 * 1.4,
        text: msg.label,
        originalText: msg.label,
        fontSize: 14,
        fontFamily: 1,
        strokeColor: '#1e1e1e',
      };
      allElements.push(labelEl);
    }
  }

  if (title) {
    allElements.unshift(createTitle(title, allElements));
  }

  return allElements;
}
