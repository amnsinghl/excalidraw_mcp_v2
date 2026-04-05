import fs from 'fs';
import path from 'path';
import { StorageBackend } from './types.js';
import { ServerElement, generateId } from '../types.js';
import logger from '../utils/logger.js';

/**
 * File-based storage backend.
 * Stores elements in-memory and persists to a .excalidraw JSON file on every write.
 */
export class FileStorageBackend implements StorageBackend {
  readonly mode = 'file' as const;
  private elements = new Map<string, ServerElement>();
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        const elems: ServerElement[] = Array.isArray(data)
          ? data
          : (data.elements || []);
        this.elements.clear();
        for (const el of elems) {
          if (el.id) {
            this.elements.set(el.id, el);
          }
        }
        logger.info(`FileStorageBackend: loaded ${this.elements.size} elements from ${this.filePath}`);
      } else {
        logger.info(`FileStorageBackend: no file at ${this.filePath}, starting empty`);
      }
    } catch (err) {
      logger.warn(`FileStorageBackend: failed to load ${this.filePath}: ${(err as Error).message}`);
    }
  }

  private persistToDisk(): void {
    const scene = {
      type: 'excalidraw',
      version: 2,
      source: 'mcp-excalidraw-server',
      elements: Array.from(this.elements.values()),
      appState: {
        viewBackgroundColor: '#ffffff',
        gridSize: null,
      },
      files: {},
    };
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(scene, null, 2), 'utf-8');
  }

  private snapshotPath(name: string): string {
    const dir = path.dirname(this.filePath);
    const base = path.basename(this.filePath, path.extname(this.filePath));
    return path.join(dir, `${base}.snapshot.${name}.excalidraw`);
  }

  async createElement(element: ServerElement): Promise<ServerElement> {
    this.elements.set(element.id, element);
    this.persistToDisk();
    return element;
  }

  async updateElement(id: string, updates: Partial<ServerElement>): Promise<ServerElement | null> {
    const existing = this.elements.get(id);
    if (!existing) return null;
    const updated: ServerElement = {
      ...existing,
      ...updates,
      id, // ensure id is not overwritten
      updatedAt: new Date().toISOString(),
    };
    this.elements.set(id, updated);
    this.persistToDisk();
    return updated;
  }

  async deleteElement(id: string): Promise<boolean> {
    const existed = this.elements.delete(id);
    if (existed) this.persistToDisk();
    return existed;
  }

  async getElement(id: string): Promise<ServerElement | null> {
    return this.elements.get(id) || null;
  }

  async getAllElements(): Promise<ServerElement[]> {
    return Array.from(this.elements.values());
  }

  async queryElements(type?: string, filter?: Record<string, any>): Promise<ServerElement[]> {
    let results = Array.from(this.elements.values());
    if (type) {
      results = results.filter(el => el.type === type);
    }
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        results = results.filter(el => (el as any)[key] === value);
      }
    }
    return results;
  }

  async batchCreate(elements: ServerElement[]): Promise<ServerElement[]> {
    for (const el of elements) {
      this.elements.set(el.id, el);
    }
    this.persistToDisk();
    return elements;
  }

  async clear(): Promise<void> {
    this.elements.clear();
    this.persistToDisk();
  }

  async saveSnapshot(name: string): Promise<{ name: string; elementCount: number; createdAt: string }> {
    const elements = Array.from(this.elements.values());
    const snapshot = {
      type: 'excalidraw',
      version: 2,
      source: 'mcp-excalidraw-server',
      elements,
      appState: { viewBackgroundColor: '#ffffff', gridSize: null },
      files: {},
      snapshotName: name,
      createdAt: new Date().toISOString(),
    };
    const snPath = this.snapshotPath(name);
    const dir = path.dirname(snPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(snPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return { name, elementCount: elements.length, createdAt: snapshot.createdAt };
  }

  async restoreSnapshot(name: string): Promise<ServerElement[]> {
    const snPath = this.snapshotPath(name);
    if (!fs.existsSync(snPath)) {
      throw new Error(`Snapshot "${name}" not found at ${snPath}`);
    }
    const raw = fs.readFileSync(snPath, 'utf-8');
    const data = JSON.parse(raw);
    const elements: ServerElement[] = data.elements || [];
    this.elements.clear();
    for (const el of elements) {
      if (el.id) this.elements.set(el.id, el);
    }
    this.persistToDisk();
    return elements;
  }

  /** Get current file path (for testing/info) */
  getFilePath(): string {
    return this.filePath;
  }

  /** Switch to a different file. Loads existing elements if the file exists, otherwise starts empty. */
  openFile(newPath: string): { filePath: string; elementCount: number } {
    this.filePath = path.resolve(newPath);
    this.elements.clear();
    this.loadFromDisk();
    return { filePath: this.filePath, elementCount: this.elements.size };
  }
}
