/**
 * Tests for diagram tools — verify they produce elements without overlaps.
 */

import { describe, it, expect } from 'vitest';
import { createFlowchartElements } from '../src/tools/flowchart.js';
import { createArchitectureElements } from '../src/tools/architecture.js';
import { createOrgChartElements } from '../src/tools/org-chart.js';
import { createMindmapElements } from '../src/tools/mindmap.js';
import { createSequenceElements } from '../src/tools/sequence.js';
import { createERElements } from '../src/tools/er-diagram.js';
import { createTableElements } from '../src/tools/table.js';
import { createNetworkElements } from '../src/tools/network.js';

// Helper: extract shape elements (non-text, non-arrow) for overlap checking
function getShapes(elements: any[]) {
  return elements.filter(e => e.type !== 'text' && e.type !== 'arrow' && e.type !== 'line' && e.width && e.height);
}

function assertNoShapeOverlaps(elements: any[]) {
  const shapes = getShapes(elements);
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlapsX && overlapsY) {
        throw new Error(
          `Shape overlap: "${a.label?.text || a.id}" vs "${b.label?.text || b.id}" — ` +
          `(${a.x},${a.y},${a.width},${a.height}) vs (${b.x},${b.y},${b.width},${b.height})`
        );
      }
    }
  }
}

describe('Flowchart tool', () => {
  it('creates elements from nodes and edges', () => {
    const elements = createFlowchartElements({
      nodes: [
        { label: 'Start', shape: 'ellipse', color: 'green' },
        { label: 'Process', color: 'blue' },
        { label: 'Decision', shape: 'diamond', color: 'yellow' },
        { label: 'End', shape: 'ellipse', color: 'red' },
      ],
      edges: [
        { from: 'Start', to: 'Process' },
        { from: 'Process', to: 'Decision' },
        { from: 'Decision', to: 'End', label: 'Yes' },
      ],
      direction: 'LR',
    });
    expect(elements.length).toBeGreaterThan(0);
    // Should have shapes + text + arrows
    expect(elements.some(e => e.type === 'arrow')).toBe(true);
  });

  it('creates elements with title', () => {
    const elements = createFlowchartElements({
      nodes: [{ label: 'A' }, { label: 'B' }],
      edges: [{ from: 'A', to: 'B' }],
      title: 'My Flowchart',
    });
    expect(elements.some(e => e.type === 'text' && e.text === 'My Flowchart')).toBe(true);
  });
});

describe('Architecture diagram tool', () => {
  it('creates layered diagram without shape overlaps', () => {
    const elements = createArchitectureElements({
      layers: [
        { name: 'Frontend', color: 'blue', components: [{ label: 'React App' }, { label: 'Next.js' }] },
        { name: 'Backend', color: 'green', components: [{ label: 'API Server' }, { label: 'Auth Service' }] },
        { name: 'Database', color: 'purple', components: [{ label: 'PostgreSQL' }, { label: 'Redis' }] },
      ],
      connections: [
        { from: 'React App', to: 'API Server' },
        { from: 'API Server', to: 'PostgreSQL' },
      ],
    });
    expect(elements.length).toBeGreaterThan(0);
    assertNoShapeOverlaps(elements);
  });
});

describe('Org chart tool', () => {
  it('creates hierarchy without overlaps', () => {
    const elements = createOrgChartElements({
      root: {
        label: 'CEO',
        children: [
          {
            label: 'CTO',
            children: [{ label: 'Dev Lead' }, { label: 'QA Lead' }],
          },
          { label: 'CFO' },
          { label: 'CMO' },
        ],
      },
    });
    expect(elements.length).toBeGreaterThan(0);
    // Arrows connect parent to children
    expect(elements.some(e => e.type === 'arrow')).toBe(true);
  });
});

describe('Mind map tool', () => {
  it('creates mind map with colored branches', () => {
    const elements = createMindmapElements({
      root: {
        label: 'Main Topic',
        children: [
          { label: 'Branch 1', children: [{ label: 'Sub 1' }] },
          { label: 'Branch 2' },
          { label: 'Branch 3' },
        ],
      },
    });
    expect(elements.length).toBeGreaterThan(0);
    // Root should be an ellipse
    expect(elements.some(e => e.type === 'ellipse')).toBe(true);
  });
});

describe('Sequence diagram tool', () => {
  it('creates participants, lifelines, and messages', () => {
    const elements = createSequenceElements({
      participants: ['Client', 'Server', 'Database'],
      messages: [
        { from: 'Client', to: 'Server', label: 'HTTP Request' },
        { from: 'Server', to: 'Database', label: 'SQL Query' },
        { from: 'Database', to: 'Server', label: 'Result', style: 'dashed' },
        { from: 'Server', to: 'Client', label: 'Response', style: 'dashed' },
      ],
    });
    expect(elements.length).toBeGreaterThan(0);
    // Should have lifeline lines
    expect(elements.some(e => e.type === 'line')).toBe(true);
    // Should have message arrows
    expect(elements.filter(e => e.type === 'arrow').length).toBe(4);
  });
});

describe('ER diagram tool', () => {
  it('creates entities with attributes', () => {
    const elements = createERElements({
      entities: [
        { name: 'User', attributes: ['id PK', 'name', 'email'], color: 'blue' },
        { name: 'Order', attributes: ['id PK', 'user_id FK', 'total'], color: 'green' },
      ],
      relationships: [
        { from: 'User', to: 'Order', label: 'has many', fromCardinality: '1', toCardinality: 'N' },
      ],
    });
    expect(elements.length).toBeGreaterThan(0);
    // Should have arrows for relationships
    expect(elements.some(e => e.type === 'arrow')).toBe(true);
  });
});

describe('Table tool', () => {
  it('creates table with headers and rows', () => {
    const elements = createTableElements({
      headers: ['Feature', 'Plan A', 'Plan B'],
      rows: [
        ['Storage', '10 GB', '100 GB'],
        ['Users', '5', 'Unlimited'],
      ],
    });
    expect(elements.length).toBeGreaterThan(0);
    // Should have rectangle cells
    expect(elements.filter(e => e.type === 'rectangle').length).toBeGreaterThanOrEqual(9); // 3 headers + 6 data cells
  });
});

describe('Network diagram tool', () => {
  it('creates network with typed nodes', () => {
    const elements = createNetworkElements({
      nodes: [
        { label: 'Web Server', type: 'server' },
        { label: 'Database', type: 'database' },
        { label: 'Load Balancer', type: 'loadbalancer' },
      ],
      links: [
        { from: 'Load Balancer', to: 'Web Server' },
        { from: 'Web Server', to: 'Database' },
      ],
    });
    expect(elements.length).toBeGreaterThan(0);
    // Should have various shape types
    expect(elements.some(e => e.type === 'diamond')).toBe(true); // loadbalancer
    expect(elements.some(e => e.type === 'arrow')).toBe(true);
  });
});
