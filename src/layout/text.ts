/**
 * Text width estimation and box dimension computation.
 * Ported from excalidraw-mcp elements/text.py
 *
 * CJK-aware: handles Chinese/Japanese/Korean characters that render wider
 * than Latin characters. Coefficients tuned for Excalidraw's hand-drawn font.
 */

export function estimateTextWidth(text: string, fontSize: number = 20): number {
  let total = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK Unified Ideographs
      (cp >= 0x3400 && cp <= 0x4dbf) ||   // CJK Extension A
      (cp >= 0x20000 && cp <= 0x2a6df) || // CJK Extension B
      (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK Compatibility Ideographs
      (cp >= 0x2f800 && cp <= 0x2fa1f) || // CJK Compatibility Supplement
      (cp >= 0x3000 && cp <= 0x303f) ||   // CJK Symbols and Punctuation
      (cp >= 0xff00 && cp <= 0xffef)      // Halfwidth and Fullwidth Forms
    ) {
      total += fontSize * 1.1;
    } else if (ch === ' ') {
      total += fontSize * 0.35;
    } else if (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= '0' && ch <= '9')
    ) {
      total += fontSize * 0.62;
    } else {
      total += fontSize * 0.65;
    }
  }
  return total;
}

// Box sizing constants
export const BOX_PADDING = 60;
export const MIN_BOX_WIDTH = 200;
export const DEFAULT_BOX_HEIGHT = 70;
export const DEFAULT_FONT_SIZE = 20;

export function computeBoxWidth(label: string, fontSize: number = DEFAULT_FONT_SIZE, padding: number = BOX_PADDING, minWidth: number = MIN_BOX_WIDTH): number {
  const textWidth = estimateTextWidth(label, fontSize);
  return Math.max(textWidth + padding, minWidth);
}
