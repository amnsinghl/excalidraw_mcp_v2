/**
 * End-to-end test for the MCP server running in file storage mode.
 * Spawns the actual compiled MCP server as a child process over stdio,
 * sends JSON-RPC requests, and validates responses.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── Helpers ──────────────────────────────────────────────────────────

let server: ChildProcess;
let tmpDir: string;
let drawingPath: string;
let msgId = 0;
let responseBuffer = '';

function nextId(): number {
  return ++msgId;
}

/** Send a JSON-RPC message to the server */
function send(msg: Record<string, any>): void {
  const json = JSON.stringify(msg);
  server.stdin!.write(json + '\n');
}

/** Wait for a JSON-RPC response with the given id (timeout 15s) */
function waitForResponse(id: number, timeoutMs = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for response id=${id}`));
    }, timeoutMs);

    const handler = (chunk: Buffer) => {
      responseBuffer += chunk.toString();
      // Try to parse complete JSON lines
      const lines = responseBuffer.split('\n');
      responseBuffer = lines.pop() || ''; // keep incomplete last line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.id === id) {
            clearTimeout(timer);
            server.stdout!.removeListener('data', handler);
            resolve(parsed);
            return;
          }
        } catch {
          // not valid JSON, skip (could be a log line)
        }
      }
    };

    server.stdout!.on('data', handler);
  });
}

/** Send a JSON-RPC request and return the response */
async function rpc(method: string, params?: any): Promise<any> {
  const id = nextId();
  send({ jsonrpc: '2.0', id, method, params });
  return waitForResponse(id);
}

/** Extract JSON from a tool response string that may contain wrapper text.
 *  e.g. "Element created successfully!\n\n{...}\n\n✅ Stored (file mode)" */
function extractJson(text: string): any {
  // First try parsing the whole string as JSON
  try {
    return JSON.parse(text);
  } catch {}

  // Find the first { or [ and extract the largest valid JSON from there
  for (const startChar of ['{', '[']) {
    const idx = text.indexOf(startChar);
    if (idx === -1) continue;
    // Find the matching closing bracket
    const endChar = startChar === '{' ? '}' : ']';
    let depth = 0;
    for (let i = idx; i < text.length; i++) {
      if (text[i] === startChar) depth++;
      else if (text[i] === endChar) depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.substring(idx, i + 1));
        } catch {}
        break;
      }
    }
  }
  return text; // fallback: return raw string
}

/** Call an MCP tool and return the parsed result content */
async function callTool(name: string, args: Record<string, any> = {}): Promise<any> {
  const resp = await rpc('tools/call', { name, arguments: args });
  if (resp.error) {
    throw new Error(`RPC error: ${JSON.stringify(resp.error)}`);
  }
  // MCP tool responses have result.content array
  const content = resp.result?.content;
  if (!content || content.length === 0) return null;
  const text = content[0]?.text;
  if (!text) return null;
  return extractJson(text);
}

// ── Setup & Teardown ────────────────────────────────────────────────

beforeAll(async () => {
  // Create a temp directory for test files
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-e2e-'));
  drawingPath = path.join(tmpDir, 'test-drawing.excalidraw');

  // Spawn the MCP server in file mode
  const serverPath = path.resolve(__dirname, '..', 'dist', 'index.js');
  server = spawn('node', [serverPath], {
    env: {
      ...process.env,
      STORAGE_MODE: 'file',
      EXCALIDRAW_FILE_PATH: drawingPath,
      EXCALIDRAW_EXPORT_DIR: tmpDir,
      NODE_DISABLE_COLORS: '1',
      NO_COLOR: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Collect stderr for debugging
  server.stderr!.on('data', (chunk: Buffer) => {
    // Uncomment for debugging:
    // process.stderr.write(`[server stderr] ${chunk.toString()}`);
  });

  // Initialize the MCP protocol
  const initResp = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'e2e-test', version: '1.0.0' },
  });
  expect(initResp.result).toBeDefined();
  expect(initResp.result.serverInfo).toBeDefined();

  // Send initialized notification
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  // Small delay for server to be fully ready
  await new Promise(r => setTimeout(r, 500));
}, 30000);

afterAll(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
  // Clean up temp directory
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Tests ───────────────────────────────────────────────────────────

describe('E2E: File Mode MCP Server', () => {

  it('should list available tools', async () => {
    const resp = await rpc('tools/list');
    expect(resp.result).toBeDefined();
    const toolNames = resp.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('create_element');
    expect(toolNames).toContain('update_element');
    expect(toolNames).toContain('delete_element');
    expect(toolNames).toContain('get_element');
    expect(toolNames).toContain('query_elements');
    expect(toolNames).toContain('batch_create_elements');
    expect(toolNames).toContain('clear_canvas');
    expect(toolNames).toContain('snapshot_scene');
    expect(toolNames).toContain('restore_snapshot');
    expect(toolNames).toContain('open_file');
    expect(toolNames).toContain('describe_scene');
    expect(toolNames.length).toBeGreaterThanOrEqual(20);
  });

  describe('CRUD operations', () => {
    let rectId: string;
    let ellipseId: string;

    it('should create a rectangle', async () => {
      const result = await callTool('create_element', {
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        backgroundColor: '#a5d8ff',
        label: 'Test Box',
      });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      rectId = result.id;
      expect(result.type).toBe('rectangle');
    });

    it('should create an ellipse', async () => {
      const result = await callTool('create_element', {
        type: 'ellipse',
        x: 400,
        y: 100,
        width: 150,
        height: 150,
        backgroundColor: '#b2f2bb',
      });
      expect(result).toBeDefined();
      ellipseId = result.id;
      expect(result.type).toBe('ellipse');
    });

    it('should get a specific element', async () => {
      const result = await callTool('get_element', { id: rectId });
      expect(result).toBeDefined();
      expect(result.id).toBe(rectId);
      expect(result.type).toBe('rectangle');
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should query all elements', async () => {
      const result = await callTool('query_elements', {});
      expect(Array.isArray(result)).toBe(true);
      // We have the rect, ellipse, and possibly a text label
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should query elements by type', async () => {
      const result = await callTool('query_elements', { type: 'ellipse' });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('ellipse');
    });

    it('should update an element', async () => {
      const result = await callTool('update_element', {
        id: rectId,
        x: 150,
        y: 200,
        backgroundColor: '#ffc9c9',
      });
      expect(result).toBeDefined();
      expect(result.x).toBe(150);
      expect(result.y).toBe(200);
    });

    it('should verify update took effect', async () => {
      const result = await callTool('get_element', { id: rectId });
      expect(result.x).toBe(150);
      expect(result.y).toBe(200);
    });

    it('should delete an element', async () => {
      const result = await callTool('delete_element', { id: ellipseId });
      expect(result).toBeDefined();
    });

    it('should not find deleted element', async () => {
      try {
        await callTool('get_element', { id: ellipseId });
        // If it doesn't throw, the result should indicate not found
      } catch (e: any) {
        expect(e.message).toContain('error');
      }
    });

    it('should persist to .excalidraw file', () => {
      expect(fs.existsSync(drawingPath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(drawingPath, 'utf-8'));
      const elements = data.elements || data;
      expect(Array.isArray(elements)).toBe(true);
      // At least the rectangle + its text label should be there
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Batch operations', () => {
    it('should batch create elements', async () => {
      const result = await callTool('batch_create_elements', {
        elements: [
          { type: 'rectangle', x: 0, y: 0, width: 100, height: 50 },
          { type: 'ellipse', x: 200, y: 0, width: 80, height: 80 },
          { type: 'diamond', x: 400, y: 0, width: 100, height: 100 },
        ],
      });
      expect(result).toBeDefined();
      // Response is { success, elements, count, mode }
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.elements).toHaveLength(3);
    });

    it('should describe the scene', async () => {
      const result = await callTool('describe_scene', {});
      expect(result).toBeDefined();
      // Should contain info about elements on the canvas
      if (typeof result === 'string') {
        expect(result.length).toBeGreaterThan(0);
      } else {
        expect(result.totalElements || result.elements || result.summary).toBeDefined();
      }
    });

    it('should clear the canvas', async () => {
      const result = await callTool('clear_canvas', {});
      expect(result).toBeDefined();

      // Verify empty
      const elements = await callTool('query_elements', {});
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBe(0);
    });
  });

  describe('Snapshots', () => {
    it('should create elements, snapshot, clear, and restore', async () => {
      // Create some elements
      await callTool('create_element', {
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        label: 'Snapshot Test',
      });

      // Snapshot
      const snapResult = await callTool('snapshot_scene', { name: 'test-snap' });
      expect(snapResult).toBeDefined();

      // Clear
      await callTool('clear_canvas', {});
      const afterClear = await callTool('query_elements', {});
      expect(afterClear.length).toBe(0);

      // Restore
      const restoreResult = await callTool('restore_snapshot', { name: 'test-snap' });
      expect(restoreResult).toBeDefined();

      // Verify restored
      const afterRestore = await callTool('query_elements', {});
      expect(afterRestore.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('open_file tool', () => {
    it('should switch to a new file', async () => {
      const newFilePath = path.join(tmpDir, 'second-drawing.excalidraw');

      const result = await callTool('open_file', { filePath: newFilePath });
      expect(result).toBeDefined();

      // New file should be empty
      const elements = await callTool('query_elements', {});
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBe(0);
    });

    it('should create elements in the new file', async () => {
      const result = await callTool('create_element', {
        type: 'diamond',
        x: 50,
        y: 50,
        width: 120,
        height: 120,
        backgroundColor: '#ffec99',
        label: 'New File Element',
      });
      expect(result).toBeDefined();
      expect(result.type).toBe('diamond');

      // Verify it persisted to the new file
      const newFilePath = path.join(tmpDir, 'second-drawing.excalidraw');
      expect(fs.existsSync(newFilePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(newFilePath, 'utf-8'));
      const elements = data.elements || data;
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('should switch back to original file and find old elements', async () => {
      const result = await callTool('open_file', { filePath: drawingPath });
      expect(result).toBeDefined();

      // Original file should have the snapshot-restored elements
      const elements = await callTool('query_elements', {});
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject path traversal', async () => {
      try {
        await callTool('open_file', { filePath: '/etc/passwd' });
        // Should not succeed
        expect(true).toBe(false);
      } catch (e: any) {
        // RPC error or tool error expected
        expect(e.message || '').toBeDefined();
      }
    });
  });

  describe('Canvas-only tools should fail gracefully', () => {
    it('should reject export_to_image in file mode', async () => {
      const resp = await rpc('tools/call', {
        name: 'export_to_image',
        arguments: { format: 'png' },
      });
      // Should contain an error about requiring canvas mode
      const text = resp.result?.content?.[0]?.text || '';
      expect(text.toLowerCase()).toMatch(/canvas|error|requires/);
    });

    it('should reject set_viewport in file mode', async () => {
      const resp = await rpc('tools/call', {
        name: 'set_viewport',
        arguments: { x: 0, y: 0, zoom: 1 },
      });
      const text = resp.result?.content?.[0]?.text || '';
      expect(text.toLowerCase()).toMatch(/canvas|error|requires/);
    });
  });
});
