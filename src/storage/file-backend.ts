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
    const rawElements = Array.from(this.elements.values());
    const excalidrawElements = this.convertToExcalidrawFormat(rawElements);
    const scene = {
      type: 'excalidraw',
      version: 2,
      source: 'mcp-excalidraw-server',
      elements: excalidrawElements,
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

  /**
   * Convert internal ServerElement format to native Excalidraw format:
   * - label: { text } on shapes → separate bound text element + boundElements on parent
   * - start/end: { id } on arrows → startBinding/endBinding + boundElements on target shapes
   * - Add required Excalidraw defaults (fillStyle, roughness, strokeWidth, etc.)
   */
  private convertToExcalidrawFormat(elements: ServerElement[]): any[] {
    const output: any[] = [];
    // Track which shapes have bound arrows/text for boundElements
    const boundElementsMap = new Map<string, { id: string; type: string }[]>();

    const addBound = (parentId: string, childId: string, childType: string) => {
      if (!boundElementsMap.has(parentId)) boundElementsMap.set(parentId, []);
      boundElementsMap.get(parentId)!.push({ id: childId, type: childType });
    };

    // First pass: build bound text elements and collect binding info
    const textElements: any[] = [];
    const processedElements: any[] = [];

    for (const el of elements) {
      const base = this.toExcalidrawBase(el);

      if (el.type === 'arrow') {
        // Convert start/end to startBinding/endBinding (legacy API path)
        // Only if no bindings already set by the layout engine
        const startId = (el as any).start?.id || (el as any).startElementId;
        const endId = (el as any).end?.id || (el as any).endElementId;

        if (startId && !base.startBinding) {
          base.startBinding = { elementId: startId, focus: 0, gap: 1 };
          addBound(startId, el.id, 'arrow');
        } else if (base.startBinding?.elementId) {
          addBound(base.startBinding.elementId, el.id, 'arrow');
        }
        if (endId && !base.endBinding) {
          base.endBinding = { elementId: endId, focus: 0, gap: 1 };
          addBound(endId, el.id, 'arrow');
        } else if (base.endBinding?.elementId) {
          addBound(base.endBinding.elementId, el.id, 'arrow');
        }
        delete base.start;
        delete base.end;

        // Fix arrow points - compute edge-to-edge positions for bound arrows
        if (startId && endId) {
          const startEl = this.elements.get(startId);
          const endEl = this.elements.get(endId);
          if (startEl && endEl) {
            const sCx = (startEl.x || 0) + ((startEl.width || 0) / 2);
            const sCy = (startEl.y || 0) + ((startEl.height || 0) / 2);
            const eCx = (endEl.x || 0) + ((endEl.width || 0) / 2);
            const eCy = (endEl.y || 0) + ((endEl.height || 0) / 2);

            // Determine direction: primarily vertical or horizontal
            const dx = eCx - sCx;
            const dy = eCy - sCy;
            let sx: number, sy: number, ex: number, ey: number;

            if (Math.abs(dy) >= Math.abs(dx)) {
              // Vertical: exit bottom of source, enter top of target (or vice versa)
              if (dy > 0) {
                sx = sCx;
                sy = (startEl.y || 0) + (startEl.height || 0); // bottom edge
                ex = eCx;
                ey = endEl.y || 0; // top edge
              } else {
                sx = sCx;
                sy = startEl.y || 0; // top edge
                ex = eCx;
                ey = (endEl.y || 0) + (endEl.height || 0); // bottom edge
              }
            } else {
              // Horizontal: exit right of source, enter left of target (or vice versa)
              if (dx > 0) {
                sx = (startEl.x || 0) + (startEl.width || 0); // right edge
                sy = sCy;
                ex = endEl.x || 0; // left edge
                ey = eCy;
              } else {
                sx = startEl.x || 0; // left edge
                sy = sCy;
                ex = (endEl.x || 0) + (endEl.width || 0); // right edge
                ey = eCy;
              }
            }

            base.x = sx;
            base.y = sy;
            base.width = Math.abs(ex - sx);
            base.height = Math.abs(ey - sy);
            base.points = [[0, 0], [ex - sx, ey - sy]];
          }
        }

        // Convert arrow label to bound text
        if ((el as any).label?.text) {
          const textId = el.id + '_label';
          const labelText = (el as any).label.text;
          textElements.push({
            id: textId,
            type: 'text',
            x: base.x + (base.width || 0) / 2,
            y: base.y + (base.height || 0) / 2 - 10,
            width: labelText.length * 10,
            height: 20,
            text: labelText,
            fontSize: (el as any).label.fontSize || 16,
            fontFamily: 1,
            textAlign: 'center',
            verticalAlign: 'middle',
            containerId: el.id,
            originalText: labelText,
            autoResize: true,
            strokeColor: '#1e1e1e',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 2,
            roughness: 1,
            opacity: 100,
            roundness: null,
            seed: Math.floor(Math.random() * 2000000000),
            version: 1,
            versionNonce: Math.floor(Math.random() * 2000000000),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            lineHeight: 1.25,
          });
          addBound(el.id, textId, 'text');
          delete base.label;
        }

        processedElements.push(base);
      } else if (el.type === 'text') {
        // Standalone text — just add defaults
        processedElements.push(base);
      } else {
        // Shape (rectangle, ellipse, diamond)
        // Convert label to bound text element
        if ((el as any).label?.text) {
          const textId = el.id + '_label';
          const labelText = (el as any).label.text;
          const fontSize = (el as any).label.fontSize || (el as any).fontSize || 20;
          textElements.push({
            id: textId,
            type: 'text',
            x: (el.x || 0) + 10,
            y: (el.y || 0) + 10,
            width: (el.width || 200) - 20,
            height: fontSize * 1.25,
            text: labelText,
            fontSize,
            fontFamily: 1,
            textAlign: 'center',
            verticalAlign: 'middle',
            containerId: el.id,
            originalText: labelText,
            autoResize: true,
            strokeColor: base.strokeColor || '#1e1e1e',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 2,
            roughness: 1,
            opacity: 100,
            roundness: null,
            seed: Math.floor(Math.random() * 2000000000),
            version: 1,
            versionNonce: Math.floor(Math.random() * 2000000000),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            lineHeight: 1.25,
          });
          addBound(el.id, textId, 'text');
          delete base.label;
        }

        processedElements.push(base);
      }
    }

    // Second pass: merge boundElements arrays (preserve existing + add new)
    for (const el of processedElements) {
      const newBounds = boundElementsMap.get(el.id);
      if (newBounds) {
        const existing: { id: string; type: string }[] = Array.isArray(el.boundElements) ? el.boundElements : [];
        const existingIds = new Set(existing.map((b: any) => b.id));
        const merged = [...existing];
        for (const b of newBounds) {
          if (!existingIds.has(b.id)) merged.push(b);
        }
        el.boundElements = merged.length > 0 ? merged : null;
      }
      output.push(el);
    }

    // Add text elements after their parents
    for (const te of textElements) {
      output.push(te);
    }

    return output;
  }

  /** Convert a ServerElement to base Excalidraw element with required defaults */
  private toExcalidrawBase(el: ServerElement): any {
    const base: any = {
      id: el.id,
      type: el.type,
      x: el.x || 0,
      y: el.y || 0,
      width: el.width || 0,
      height: el.height || 0,
      strokeColor: el.strokeColor || '#1e1e1e',
      backgroundColor: el.backgroundColor || 'transparent',
      fillStyle: el.backgroundColor && el.backgroundColor !== 'transparent' ? 'solid' : 'solid',
      strokeWidth: el.strokeWidth || 2,
      roughness: (el as any).roughness ?? 1,
      opacity: (el as any).opacity ?? 100,
      seed: Math.floor(Math.random() * 2000000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
      isDeleted: false,
      boundElements: (el as any).boundElements || null,
      updated: Date.now(),
      link: null,
      locked: (el as any).locked || false,
      roundness: (el as any).roundness || (el.type === 'rectangle' ? { type: 3 } : null),
    };

    // Copy groupIds
    if ((el as any).groupIds) base.groupIds = (el as any).groupIds;
    else base.groupIds = [];

    // Arrow-specific
    if (el.type === 'arrow' || el.type === 'line') {
      base.points = (el as any).points || [[0, 0], [100, 0]];
      base.endArrowhead = (el as any).endArrowhead || (el.type === 'arrow' ? 'arrow' : null);
      base.startArrowhead = (el as any).startArrowhead || null;
      base.lastCommittedPoint = null;
      // Preserve bindings from layout engine if present
      base.startBinding = (el as any).startBinding || null;
      base.endBinding = (el as any).endBinding || null;
      if ((el as any).label) base.label = (el as any).label;
    }

    // Text-specific
    if (el.type === 'text') {
      base.text = (el as any).text || '';
      base.fontSize = (el as any).fontSize || 20;
      base.fontFamily = (el as any).fontFamily || 1;
      base.textAlign = (el as any).textAlign || 'left';
      base.verticalAlign = (el as any).verticalAlign || 'top';
      base.originalText = (el as any).text || '';
      base.autoResize = true;
      base.lineHeight = 1.25;
      base.containerId = (el as any).containerId || null;
    }

    // Shape labels kept temporarily for processing
    if ((el as any).label) base.label = (el as any).label;

    return base;
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
