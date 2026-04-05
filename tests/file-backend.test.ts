import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileStorageBackend } from '../src/storage/file-backend.js';
import { ServerElement } from '../src/types.js';

// Use temp directory for test files to avoid polluting the project
const TEST_DIR = path.join(os.tmpdir(), 'excalidraw-mcp-tests-' + Date.now());
const TEST_FILE = path.join(TEST_DIR, 'test-drawing.excalidraw');

function makeElement(overrides: Partial<ServerElement> = {}): ServerElement {
  return {
    id: 'el-' + Math.random().toString(36).slice(2, 8),
    type: 'rectangle',
    x: 100,
    y: 200,
    width: 160,
    height: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  } as ServerElement;
}

function makeArrow(overrides: Partial<ServerElement> = {}): ServerElement {
  return makeElement({ type: 'arrow', width: undefined, height: undefined, ...overrides });
}

function makeText(overrides: Partial<ServerElement> = {}): ServerElement {
  return makeElement({ type: 'text', text: 'hello', width: undefined, height: undefined, ...overrides });
}

function cleanTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

afterAll(() => {
  cleanTestDir();
});

// =========================================================================
// T1: Basic CRUD
// =========================================================================
describe('T1: FileStorageBackend — Basic CRUD', () => {
  let backend: FileStorageBackend;

  beforeEach(() => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    backend = new FileStorageBackend(TEST_FILE);
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('T1.1: Create element in file mode', async () => {
    const el = makeElement({ id: 'rect-1' });
    const result = await backend.createElement(el);

    expect(result.id).toBe('rect-1');
    expect(result.type).toBe('rectangle');

    // Verify file was written
    expect(fs.existsSync(TEST_FILE)).toBe(true);
    const fileContent = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(fileContent.elements).toHaveLength(1);
    expect(fileContent.elements[0].id).toBe('rect-1');
  });

  it('T1.2: Get element by ID', async () => {
    const el = makeElement({ id: 'rect-2' });
    await backend.createElement(el);

    const fetched = await backend.getElement('rect-2');
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe('rect-2');
    expect(fetched!.type).toBe('rectangle');
  });

  it('T1.3: Update element', async () => {
    const el = makeElement({ id: 'rect-3', x: 0, y: 0 });
    await backend.createElement(el);

    const updated = await backend.updateElement('rect-3', { x: 500, y: 300 } as Partial<ServerElement>);
    expect(updated).not.toBeNull();
    expect(updated!.x).toBe(500);
    expect(updated!.y).toBe(300);
    expect(updated!.id).toBe('rect-3'); // ID preserved

    // Verify persisted
    const fileContent = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(fileContent.elements[0].x).toBe(500);
  });

  it('T1.4: Delete element', async () => {
    const el = makeElement({ id: 'rect-4' });
    await backend.createElement(el);

    const deleted = await backend.deleteElement('rect-4');
    expect(deleted).toBe(true);

    const fetched = await backend.getElement('rect-4');
    expect(fetched).toBeNull();

    // Verify file updated
    const fileContent = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(fileContent.elements).toHaveLength(0);
  });

  it('T1.5: Query elements by type', async () => {
    await backend.createElement(makeElement({ id: 'r1' }));
    await backend.createElement(makeElement({ id: 'r2' }));
    await backend.createElement(makeArrow({ id: 'a1' }));

    const rectangles = await backend.queryElements('rectangle');
    expect(rectangles).toHaveLength(2);

    const arrows = await backend.queryElements('arrow');
    expect(arrows).toHaveLength(1);
  });

  it('T1.6: Get all elements', async () => {
    await backend.createElement(makeElement({ id: 'e1' }));
    await backend.createElement(makeElement({ id: 'e2' }));
    await backend.createElement(makeArrow({ id: 'e3' }));

    const all = await backend.getAllElements();
    expect(all).toHaveLength(3);
  });

  it('T1.7: Update non-existent element returns null', async () => {
    const result = await backend.updateElement('nonexistent', { x: 10 } as Partial<ServerElement>);
    expect(result).toBeNull();
  });

  it('T1.8: Delete non-existent element returns false', async () => {
    const result = await backend.deleteElement('nonexistent');
    expect(result).toBe(false);
  });

  it('T1.9: Get non-existent element returns null', async () => {
    const result = await backend.getElement('nonexistent');
    expect(result).toBeNull();
  });
});

// =========================================================================
// T2: File Persistence
// =========================================================================
describe('T2: FileStorageBackend — File Persistence', () => {
  beforeEach(() => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('T2.1: File created on first write', async () => {
    expect(fs.existsSync(TEST_FILE)).toBe(false);
    const backend = new FileStorageBackend(TEST_FILE);
    await backend.createElement(makeElement({ id: 'first' }));
    expect(fs.existsSync(TEST_FILE)).toBe(true);
  });

  it('T2.2: File loads on init', async () => {
    // Create and populate
    const backend1 = new FileStorageBackend(TEST_FILE);
    await backend1.createElement(makeElement({ id: 'persist-1' }));
    await backend1.createElement(makeElement({ id: 'persist-2' }));

    // Reload from same file
    const backend2 = new FileStorageBackend(TEST_FILE);
    const all = await backend2.getAllElements();
    expect(all).toHaveLength(2);
    expect(all.map(e => e.id).sort()).toEqual(['persist-1', 'persist-2']);
  });

  it('T2.3: File updated on every write', async () => {
    const backend = new FileStorageBackend(TEST_FILE);

    await backend.createElement(makeElement({ id: 'inc-1' }));
    let content = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(content.elements).toHaveLength(1);

    await backend.createElement(makeElement({ id: 'inc-2' }));
    content = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(content.elements).toHaveLength(2);

    await backend.createElement(makeElement({ id: 'inc-3' }));
    content = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(content.elements).toHaveLength(3);
  });

  it('T2.4: Custom file path', async () => {
    const customPath = path.join(TEST_DIR, 'custom', 'nested', 'my-drawing.excalidraw');
    const backend = new FileStorageBackend(customPath);
    await backend.createElement(makeElement({ id: 'custom-1' }));

    expect(fs.existsSync(customPath)).toBe(true);
    expect(backend.getFilePath()).toBe(path.resolve(customPath));
  });

  it('T2.5: Excalidraw JSON format is valid', async () => {
    const backend = new FileStorageBackend(TEST_FILE);
    await backend.createElement(makeElement({ id: 'fmt-1' }));

    const content = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(content.type).toBe('excalidraw');
    expect(content.version).toBe(2);
    expect(content.source).toBe('mcp-excalidraw-server');
    expect(content.appState).toBeDefined();
    expect(content.appState.viewBackgroundColor).toBe('#ffffff');
    expect(content.files).toEqual({});
  });
});

// =========================================================================
// T3: Batch & Clear
// =========================================================================
describe('T3: FileStorageBackend — Batch & Clear', () => {
  let backend: FileStorageBackend;

  beforeEach(() => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    backend = new FileStorageBackend(TEST_FILE);
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('T3.1: Batch create', async () => {
    const elements = Array.from({ length: 5 }, (_, i) =>
      makeElement({ id: `batch-${i}` })
    );
    const result = await backend.batchCreate(elements);

    expect(result).toHaveLength(5);
    const all = await backend.getAllElements();
    expect(all).toHaveLength(5);

    // File has all 5
    const content = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(content.elements).toHaveLength(5);
  });

  it('T3.2: Clear canvas', async () => {
    await backend.batchCreate([
      makeElement({ id: 'c1' }),
      makeElement({ id: 'c2' }),
    ]);
    expect((await backend.getAllElements()).length).toBe(2);

    await backend.clear();
    expect((await backend.getAllElements()).length).toBe(0);

    // File has empty array
    const content = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(content.elements).toHaveLength(0);
  });

  it('T3.3: Import scene (replace) — via clear + batchCreate', async () => {
    await backend.batchCreate([
      makeElement({ id: 'old-1' }),
      makeElement({ id: 'old-2' }),
    ]);

    // Simulate replace import
    await backend.clear();
    await backend.batchCreate([
      makeElement({ id: 'new-1' }),
      makeElement({ id: 'new-2' }),
      makeElement({ id: 'new-3' }),
    ]);

    const all = await backend.getAllElements();
    expect(all).toHaveLength(3);
    expect(all.map(e => e.id).sort()).toEqual(['new-1', 'new-2', 'new-3']);
  });

  it('T3.4: Import scene (merge) — via batchCreate', async () => {
    await backend.batchCreate([
      makeElement({ id: 'exist-1' }),
      makeElement({ id: 'exist-2' }),
    ]);

    // Merge import (no clear)
    await backend.batchCreate([
      makeElement({ id: 'merged-1' }),
      makeElement({ id: 'merged-2' }),
      makeElement({ id: 'merged-3' }),
    ]);

    const all = await backend.getAllElements();
    expect(all).toHaveLength(5);
  });
});

// =========================================================================
// T4: Snapshots
// =========================================================================
describe('T4: FileStorageBackend — Snapshots', () => {
  let backend: FileStorageBackend;

  beforeEach(() => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    backend = new FileStorageBackend(TEST_FILE);
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('T4.1: Save snapshot', async () => {
    await backend.batchCreate([
      makeElement({ id: 'snap-1' }),
      makeElement({ id: 'snap-2' }),
    ]);

    const result = await backend.saveSnapshot('v1');
    expect(result.name).toBe('v1');
    expect(result.elementCount).toBe(2);
    expect(result.createdAt).toBeDefined();

    // Snapshot file exists
    const snPath = path.join(TEST_DIR, 'test-drawing.snapshot.v1.excalidraw');
    expect(fs.existsSync(snPath)).toBe(true);
  });

  it('T4.2: Restore snapshot', async () => {
    await backend.batchCreate([
      makeElement({ id: 'orig-1', x: 10 }),
      makeElement({ id: 'orig-2', x: 20 }),
    ]);
    await backend.saveSnapshot('v1');

    // Modify state
    await backend.clear();
    await backend.createElement(makeElement({ id: 'different' }));
    expect((await backend.getAllElements()).length).toBe(1);

    // Restore
    const restored = await backend.restoreSnapshot('v1');
    expect(restored).toHaveLength(2);
    expect(restored.map(e => e.id).sort()).toEqual(['orig-1', 'orig-2']);

    // Current state matches snapshot
    const all = await backend.getAllElements();
    expect(all).toHaveLength(2);
  });

  it('T4.3: Snapshot not found', async () => {
    await expect(backend.restoreSnapshot('nonexistent')).rejects.toThrow(
      /Snapshot "nonexistent" not found/
    );
  });
});

// =========================================================================
// T5: Complex Operations
// =========================================================================
describe('T5: FileStorageBackend — Complex Operations', () => {
  let backend: FileStorageBackend;

  beforeEach(() => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    backend = new FileStorageBackend(TEST_FILE);
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('T5.1: Describe scene — getAllElements returns meaningful data', async () => {
    await backend.batchCreate([
      makeElement({ id: 'box-1', x: 0, y: 0, width: 100, height: 50 }),
      makeElement({ id: 'box-2', x: 200, y: 100, width: 100, height: 50 }),
      makeArrow({ id: 'arrow-1' }),
    ]);

    const all = await backend.getAllElements();
    expect(all).toHaveLength(3);
    const types = all.map(e => e.type);
    expect(types).toContain('rectangle');
    expect(types).toContain('arrow');
  });

  it('T5.2: Export scene — getAllElements produces valid JSON', async () => {
    await backend.batchCreate([
      makeElement({ id: 'exp-1' }),
      makeText({ id: 'exp-2' }),
    ]);

    const elements = await backend.getAllElements();
    const scene = {
      type: 'excalidraw',
      version: 2,
      source: 'mcp-excalidraw-server',
      elements,
      appState: { viewBackgroundColor: '#ffffff', gridSize: null },
      files: {},
    };
    const json = JSON.stringify(scene);
    const parsed = JSON.parse(json);
    expect(parsed.elements).toHaveLength(2);
    expect(parsed.type).toBe('excalidraw');
  });

  it('T5.3: Align elements — update x positions', async () => {
    await backend.createElement(makeElement({ id: 'al-1', x: 50 }));
    await backend.createElement(makeElement({ id: 'al-2', x: 200 }));
    await backend.createElement(makeElement({ id: 'al-3', x: 350 }));

    // Simulate align left: set all x to min
    const all = await backend.getAllElements();
    const minX = Math.min(...all.map(e => e.x));
    for (const el of all) {
      await backend.updateElement(el.id, { x: minX } as Partial<ServerElement>);
    }

    const aligned = await backend.getAllElements();
    expect(aligned.every(e => e.x === 50)).toBe(true);
  });

  it('T5.4: Distribute elements — even spacing', async () => {
    await backend.createElement(makeElement({ id: 'dist-1', x: 0, width: 100 }));
    await backend.createElement(makeElement({ id: 'dist-2', x: 100, width: 100 }));
    await backend.createElement(makeElement({ id: 'dist-3', x: 500, width: 100 }));

    // Simulate horizontal distribute
    const all = (await backend.getAllElements()).sort((a, b) => a.x - b.x);
    const first = all[0]!;
    const last = all[all.length - 1]!;
    const totalSpan = (last.x + (last.width || 0)) - first.x;
    const totalWidth = all.reduce((s, e) => s + (e.width || 0), 0);
    const gap = (totalSpan - totalWidth) / (all.length - 1);

    let currentX = first.x;
    for (const el of all) {
      await backend.updateElement(el.id, { x: currentX } as Partial<ServerElement>);
      currentX += (el.width || 0) + gap;
    }

    const distributed = (await backend.getAllElements()).sort((a, b) => a.x - b.x);
    // Verify spacing is roughly even (within rounding)
    const gap1 = distributed[1]!.x - (distributed[0]!.x + (distributed[0]!.width || 0));
    const gap2 = distributed[2]!.x - (distributed[1]!.x + (distributed[1]!.width || 0));
    expect(Math.abs(gap1 - gap2)).toBeLessThan(1);
  });

  it('T5.5: Duplicate elements — new element at offset', async () => {
    const original = makeElement({ id: 'dup-orig', x: 100, y: 100 });
    await backend.createElement(original);

    // Simulate duplicate
    const fetched = await backend.getElement('dup-orig');
    expect(fetched).not.toBeNull();
    const duplicate: ServerElement = {
      ...fetched!,
      id: 'dup-copy',
      x: fetched!.x + 20,
      y: fetched!.y + 20,
    };
    await backend.createElement(duplicate);

    const all = await backend.getAllElements();
    expect(all).toHaveLength(2);
    const copy = await backend.getElement('dup-copy');
    expect(copy!.x).toBe(120);
    expect(copy!.y).toBe(120);
  });

  it('T5.6: Group/ungroup — groupIds added and removed', async () => {
    await backend.createElement(makeElement({ id: 'grp-1' }));
    await backend.createElement(makeElement({ id: 'grp-2' }));

    // Group
    const groupId = 'group-abc';
    await backend.updateElement('grp-1', { groupIds: [groupId] } as Partial<ServerElement>);
    await backend.updateElement('grp-2', { groupIds: [groupId] } as Partial<ServerElement>);

    let el1 = await backend.getElement('grp-1');
    expect(el1!.groupIds).toContain(groupId);

    // Ungroup
    await backend.updateElement('grp-1', { groupIds: [] } as Partial<ServerElement>);
    await backend.updateElement('grp-2', { groupIds: [] } as Partial<ServerElement>);

    el1 = await backend.getElement('grp-1');
    expect(el1!.groupIds).toEqual([]);
  });

  it('T5.7: Lock/unlock — locked flag toggled', async () => {
    await backend.createElement(makeElement({ id: 'lock-1' }));

    await backend.updateElement('lock-1', { locked: true } as Partial<ServerElement>);
    let el = await backend.getElement('lock-1');
    expect(el!.locked).toBe(true);

    await backend.updateElement('lock-1', { locked: false } as Partial<ServerElement>);
    el = await backend.getElement('lock-1');
    expect(el!.locked).toBe(false);
  });
});

// =========================================================================
// T6: Storage backend mode property
// =========================================================================
describe('T6: Storage mode property', () => {
  it('T6.1: FileStorageBackend reports mode as "file"', () => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    const backend = new FileStorageBackend(TEST_FILE);
    expect(backend.mode).toBe('file');
    cleanTestDir();
  });
});

// =========================================================================
// T6b: open_file — dynamic file switching
// =========================================================================
describe('T6b: FileStorageBackend — openFile', () => {
  beforeEach(() => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('T6b.1: Switch to a new empty file', async () => {
    const backend = new FileStorageBackend(TEST_FILE);
    await backend.createElement(makeElement({ id: 'old-1' }));
    expect((await backend.getAllElements()).length).toBe(1);

    const newPath = path.join(TEST_DIR, 'second.excalidraw');
    const result = backend.openFile(newPath);
    expect(result.elementCount).toBe(0);
    expect(result.filePath).toBe(path.resolve(newPath));
    expect((await backend.getAllElements()).length).toBe(0);
  });

  it('T6b.2: Switch to existing file and load elements', async () => {
    // Create file A with 2 elements
    const backendA = new FileStorageBackend(TEST_FILE);
    await backendA.batchCreate([
      makeElement({ id: 'a1' }),
      makeElement({ id: 'a2' }),
    ]);

    // Create file B with 3 elements
    const fileB = path.join(TEST_DIR, 'b.excalidraw');
    const backendB = new FileStorageBackend(fileB);
    await backendB.batchCreate([
      makeElement({ id: 'b1' }),
      makeElement({ id: 'b2' }),
      makeElement({ id: 'b3' }),
    ]);

    // Switch backendA to file B
    const result = backendA.openFile(fileB);
    expect(result.elementCount).toBe(3);
    const all = await backendA.getAllElements();
    expect(all.map(e => e.id).sort()).toEqual(['b1', 'b2', 'b3']);
  });

  it('T6b.3: Writes go to the new file after switch', async () => {
    const backend = new FileStorageBackend(TEST_FILE);
    await backend.createElement(makeElement({ id: 'before' }));

    const newPath = path.join(TEST_DIR, 'switched.excalidraw');
    backend.openFile(newPath);
    await backend.createElement(makeElement({ id: 'after' }));

    // New file has the new element
    const newContent = JSON.parse(fs.readFileSync(newPath, 'utf-8'));
    expect(newContent.elements).toHaveLength(1);
    expect(newContent.elements[0].id).toBe('after');

    // Old file still has the old element (untouched)
    const oldContent = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
    expect(oldContent.elements).toHaveLength(1);
    expect(oldContent.elements[0].id).toBe('before');
  });

  it('T6b.4: getFilePath returns new path after switch', () => {
    const backend = new FileStorageBackend(TEST_FILE);
    expect(backend.getFilePath()).toBe(path.resolve(TEST_FILE));

    const newPath = path.join(TEST_DIR, 'other.excalidraw');
    backend.openFile(newPath);
    expect(backend.getFilePath()).toBe(path.resolve(newPath));
  });
});

// =========================================================================
// T7: Factory function
// =========================================================================
describe('T7: createStorageBackend factory', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  it('T7.1: STORAGE_MODE=file creates FileStorageBackend', async () => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });

    process.env.STORAGE_MODE = 'file';
    process.env.EXCALIDRAW_FILE_PATH = path.join(TEST_DIR, 'factory-test.excalidraw');

    // Dynamic import to pick up env changes
    const { createStorageBackend } = await import('../src/storage/index.js');
    const backend = createStorageBackend();
    expect(backend.mode).toBe('file');

    cleanTestDir();
  });

  it('T7.2: STORAGE_MODE=canvas creates CanvasStorageBackend', async () => {
    process.env.STORAGE_MODE = 'canvas';

    const { createStorageBackend } = await import('../src/storage/index.js');
    const backend = createStorageBackend();
    expect(backend.mode).toBe('canvas');
  });

  it('T7.3: Default mode (no env) is canvas', async () => {
    delete process.env.STORAGE_MODE;

    const { createStorageBackend } = await import('../src/storage/index.js');
    const backend = createStorageBackend();
    expect(backend.mode).toBe('canvas');
  });
});

// =========================================================================
// T8: Mixed element types
// =========================================================================
describe('T8: Mixed element operations', () => {
  let backend: FileStorageBackend;

  beforeEach(() => {
    cleanTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    backend = new FileStorageBackend(TEST_FILE);
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('T8.1: Store and retrieve text elements', async () => {
    const text = makeText({ id: 'txt-1', text: 'Hello World' });
    await backend.createElement(text);

    const fetched = await backend.getElement('txt-1');
    expect(fetched).not.toBeNull();
    expect((fetched as any).text).toBe('Hello World');
  });

  it('T8.2: Query with filter', async () => {
    await backend.createElement(makeElement({ id: 'f1', x: 100 }));
    await backend.createElement(makeElement({ id: 'f2', x: 200 }));
    await backend.createElement(makeElement({ id: 'f3', x: 100 }));

    const filtered = await backend.queryElements(undefined, { x: 100 });
    expect(filtered).toHaveLength(2);
  });

  it('T8.3: Batch create preserves all element types', async () => {
    const elements = [
      makeElement({ id: 'b1', type: 'rectangle' }),
      makeElement({ id: 'b2', type: 'ellipse' }),
      makeElement({ id: 'b3', type: 'diamond' }),
      makeArrow({ id: 'b4' }),
      makeText({ id: 'b5', text: 'label' }),
    ];
    await backend.batchCreate(elements);

    const all = await backend.getAllElements();
    expect(all).toHaveLength(5);
    const types = all.map(e => e.type).sort();
    expect(types).toEqual(['arrow', 'diamond', 'ellipse', 'rectangle', 'text']);
  });
});
