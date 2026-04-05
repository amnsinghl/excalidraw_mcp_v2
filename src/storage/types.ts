import { ServerElement, Snapshot } from '../types.js';

/**
 * Abstract storage backend for Excalidraw elements.
 * Implemented by CanvasStorageBackend (HTTP) and FileStorageBackend (local file).
 */
export interface StorageBackend {
  readonly mode: 'canvas' | 'file';

  createElement(element: ServerElement): Promise<ServerElement>;
  updateElement(id: string, updates: Partial<ServerElement>): Promise<ServerElement | null>;
  deleteElement(id: string): Promise<boolean>;
  getElement(id: string): Promise<ServerElement | null>;
  getAllElements(): Promise<ServerElement[]>;
  queryElements(type?: string, filter?: Record<string, any>): Promise<ServerElement[]>;
  batchCreate(elements: ServerElement[]): Promise<ServerElement[]>;
  clear(): Promise<void>;
  saveSnapshot(name: string): Promise<{ name: string; elementCount: number; createdAt: string }>;
  restoreSnapshot(name: string): Promise<ServerElement[]>;
}
