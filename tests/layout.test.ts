/**
 * Tests for the layout engine — text sizing, Sugiyama, grid, tree, arrows, groups.
 */

import { describe, it, expect } from 'vitest';
import { estimateTextWidth, computeBoxWidth } from '../src/layout/text.js';
import { sugiyamaLayout } from '../src/layout/sugiyama.js';
import { gridLayout, layeredLayout } from '../src/layout/grid.js';
import { orgChartLayout, mindmapLayout } from '../src/layout/tree.js';
import { computeArrowLayout, autoSides } from '../src/layout/arrows.js';
import { computeGroupFrame } from '../src/layout/groups.js';

// Helper: verify no two bounding boxes overlap
function assertNoOverlaps(nodes: Array<{ x: number; y: number; width: number; height: number }>) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlapsX && overlapsY) {
        throw new Error(
          `Overlap between node ${i} (x=${a.x}, y=${a.y}, w=${a.width}, h=${a.height}) ` +
          `and node ${j} (x=${b.x}, y=${b.y}, w=${b.width}, h=${b.height})`
        );
      }
    }
  }
}

describe('Text sizing', () => {
  it('estimates ASCII text width', () => {
    const width = estimateTextWidth('Hello', 20);
    expect(width).toBeGreaterThan(50);
    expect(width).toBeLessThan(100);
  });

  it('estimates CJK text wider than ASCII', () => {
    const ascii = estimateTextWidth('ABCD', 20);
    const cjk = estimateTextWidth('你好世界', 20);
    expect(cjk).toBeGreaterThan(ascii);
  });

  it('estimates empty string as 0', () => {
    expect(estimateTextWidth('', 20)).toBe(0);
  });

  it('computes box width with padding and minimum', () => {
    const width = computeBoxWidth('Hi', 20, 60, 200);
    expect(width).toBeGreaterThanOrEqual(200); // below min, so clamped
  });
});

describe('Sugiyama layout', () => {
  it('positions nodes without overlaps in LR direction', () => {
    const nodes = [
      { label: 'Start' },
      { label: 'Process' },
      { label: 'End' },
    ];
    const edges = [
      { from: 'Start', to: 'Process' },
      { from: 'Process', to: 'End' },
    ];
    const result = sugiyamaLayout(nodes, edges, 'LR');
    expect(result).toHaveLength(3);
    assertNoOverlaps(result);
    // LR: x increases along the chain
    expect(result[0].x).toBeLessThan(result[1].x);
    expect(result[1].x).toBeLessThan(result[2].x);
  });

  it('positions nodes without overlaps in TB direction', () => {
    const nodes = [
      { label: 'A' },
      { label: 'B' },
      { label: 'C' },
    ];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
    ];
    const result = sugiyamaLayout(nodes, edges, 'TB');
    expect(result).toHaveLength(3);
    assertNoOverlaps(result);
    // TB: y increases for children
    expect(result[0].y).toBeLessThan(result[1].y);
  });

  it('handles branching paths', () => {
    const nodes = [
      { label: 'Root' },
      { label: 'Left' },
      { label: 'Right' },
      { label: 'Merge' },
    ];
    const edges = [
      { from: 'Root', to: 'Left' },
      { from: 'Root', to: 'Right' },
      { from: 'Left', to: 'Merge' },
      { from: 'Right', to: 'Merge' },
    ];
    const result = sugiyamaLayout(nodes, edges, 'LR');
    expect(result).toHaveLength(4);
    assertNoOverlaps(result);
  });

  it('handles empty input', () => {
    expect(sugiyamaLayout([], [])).toEqual([]);
  });

  it('normalizes positions to start at 0,0', () => {
    const result = sugiyamaLayout([{ label: 'A' }], []);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
  });
});

describe('Grid layout', () => {
  it('arranges nodes in a grid without overlaps', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ label: `Node ${i}` }));
    const result = gridLayout(nodes, { columns: 3 });
    expect(result).toHaveLength(6);
    assertNoOverlaps(result);
  });

  it('respects column count', () => {
    const nodes = [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }];
    const result = gridLayout(nodes, { columns: 2 });
    // Should have 2 rows, 2 columns
    expect(result[0].y).toBe(result[1].y); // same row
    expect(result[2].y).toBe(result[3].y); // same row
    expect(result[0].y).toBeLessThan(result[2].y); // different rows
  });

  it('vertical direction fills columns first', () => {
    const nodes = [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }];
    const result = gridLayout(nodes, { direction: 'vertical', columns: 2 });
    expect(result).toHaveLength(4);
    assertNoOverlaps(result);
  });
});

describe('Layered layout', () => {
  it('stacks layers vertically', () => {
    const layers = [
      { name: 'Frontend', components: [{ label: 'React' }, { label: 'Next.js' }] },
      { name: 'Backend', components: [{ label: 'API' }] },
    ];
    const result = layeredLayout(layers);
    expect(result).toHaveLength(3);
    assertNoOverlaps(result);
    // Frontend above Backend
    const frontendY = result.filter(r => r.layerName === 'Frontend')[0].y;
    const backendY = result.filter(r => r.layerName === 'Backend')[0].y;
    expect(frontendY).toBeLessThan(backendY);
  });
});

describe('Org chart layout', () => {
  it('lays out a simple tree without overlaps', () => {
    const root = {
      label: 'CEO',
      children: [
        { label: 'CTO', children: [{ label: 'Dev Lead' }, { label: 'QA Lead' }] },
        { label: 'CFO' },
      ],
    };
    const result = orgChartLayout(root);
    expect(result).toHaveLength(5);
    assertNoOverlaps(result);
    // CEO at top
    const ceo = result.find(n => n.label === 'CEO')!;
    const cto = result.find(n => n.label === 'CTO')!;
    expect(ceo.y).toBeLessThan(cto.y);
  });

  it('handles single node', () => {
    const result = orgChartLayout({ label: 'Solo' });
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
  });
});

describe('Mind map layout', () => {
  it('lays out nodes left-to-right without overlaps', () => {
    const root = {
      label: 'Central Idea',
      children: [
        { label: 'Branch A', children: [{ label: 'Leaf 1' }, { label: 'Leaf 2' }] },
        { label: 'Branch B' },
      ],
    };
    const result = mindmapLayout(root);
    expect(result).toHaveLength(5);
    assertNoOverlaps(result);
    // Root at leftmost
    const rootNode = result.find(n => n.label === 'Central Idea')!;
    const branchA = result.find(n => n.label === 'Branch A')!;
    expect(rootNode.x).toBeLessThan(branchA.x);
  });
});

describe('Arrow layout', () => {
  it('auto-detects horizontal sides', () => {
    const startEl = { id: 'a', x: 0, y: 0, width: 100, height: 50 };
    const endEl = { id: 'b', x: 300, y: 0, width: 100, height: 50 };
    const [startSide, endSide] = autoSides(startEl, endEl);
    expect(startSide).toBe('right');
    expect(endSide).toBe('left');
  });

  it('auto-detects vertical sides', () => {
    const startEl = { id: 'a', x: 0, y: 0, width: 100, height: 50 };
    const endEl = { id: 'b', x: 0, y: 300, width: 100, height: 50 };
    const [startSide, endSide] = autoSides(startEl, endEl);
    expect(startSide).toBe('bottom');
    expect(endSide).toBe('top');
  });

  it('computes arrow layout with correct bindings', () => {
    const startEl = { id: 'box1', x: 0, y: 0, width: 100, height: 50 };
    const endEl = { id: 'box2', x: 300, y: 0, width: 100, height: 50 };
    const layout = computeArrowLayout(startEl, endEl);
    expect(layout.startElementId).toBe('box1');
    expect(layout.endElementId).toBe('box2');
    expect(layout.points.length).toBeGreaterThanOrEqual(2);
  });

  it('computes elbow route with 4 points', () => {
    const startEl = { id: 'a', x: 0, y: 0, width: 100, height: 50 };
    const endEl = { id: 'b', x: 300, y: 200, width: 100, height: 50 };
    const layout = computeArrowLayout(startEl, endEl, { elbowed: true });
    expect(layout.points.length).toBe(4);
  });
});

describe('Group frame', () => {
  it('computes bounding frame around nodes', () => {
    const nodes = [
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 200, y: 20, width: 100, height: 50 },
    ];
    const frame = computeGroupFrame('Test Group', nodes);
    expect(frame).not.toBeNull();
    expect(frame!.x).toBeLessThan(10);
    expect(frame!.y).toBeLessThan(20);
    expect(frame!.width).toBeGreaterThan(290); // spans both nodes + padding
  });

  it('returns null for empty input', () => {
    expect(computeGroupFrame('Empty', [])).toBeNull();
  });
});
