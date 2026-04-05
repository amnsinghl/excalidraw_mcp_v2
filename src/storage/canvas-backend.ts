import fetch from 'node-fetch';
import { StorageBackend } from './types.js';
import { ServerElement } from '../types.js';
import logger from '../utils/logger.js';

interface ApiResponse {
  success: boolean;
  element?: ServerElement;
  elements?: ServerElement[];
  message?: string;
  error?: string;
  count?: number;
}

/**
 * Canvas-based storage backend.
 * Proxies all operations to the Express canvas server via HTTP.
 */
export class CanvasStorageBackend implements StorageBackend {
  readonly mode = 'canvas' as const;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async createElement(element: ServerElement): Promise<ServerElement> {
    const response = await fetch(`${this.serverUrl}/api/elements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(element),
    });
    const result = await response.json() as ApiResponse;
    if (!response.ok) {
      throw new Error(result.error || `Canvas create failed: ${response.status} ${response.statusText}`);
    }
    return result.element || element;
  }

  async updateElement(id: string, updates: Partial<ServerElement>): Promise<ServerElement | null> {
    const response = await fetch(`${this.serverUrl}/api/elements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const result = await response.json() as ApiResponse;
    if (!response.ok) {
      logger.warn(`Canvas update error: ${response.status}`, result);
      return null;
    }
    return result.element || null;
  }

  async deleteElement(id: string): Promise<boolean> {
    const response = await fetch(`${this.serverUrl}/api/elements/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json() as ApiResponse;
    return response.ok && result.success !== false;
  }

  async getElement(id: string): Promise<ServerElement | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/elements/${id}`);
      if (!response.ok) return null;
      const data = await response.json() as { element?: ServerElement };
      return data.element || null;
    } catch (error) {
      logger.error('Error fetching element from canvas:', error);
      return null;
    }
  }

  async getAllElements(): Promise<ServerElement[]> {
    const response = await fetch(`${this.serverUrl}/api/elements`);
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as ApiResponse;
    return data.elements || [];
  }

  async queryElements(type?: string, filter?: Record<string, any>): Promise<ServerElement[]> {
    const queryParams = new URLSearchParams();
    if (type) queryParams.set('type', type);
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        queryParams.set(key, String(value));
      }
    }
    const url = `${this.serverUrl}/api/elements/search?${queryParams}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP server error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as ApiResponse;
    return data.elements || [];
  }

  async batchCreate(elements: ServerElement[]): Promise<ServerElement[]> {
    const response = await fetch(`${this.serverUrl}/api/elements/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements }),
    });
    const result = await response.json() as ApiResponse;
    if (!response.ok) {
      throw new Error(result.error || `Batch create failed: ${response.status} ${response.statusText}`);
    }
    return result.elements || elements;
  }

  async clear(): Promise<void> {
    const response = await fetch(`${this.serverUrl}/api/elements/clear`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to clear canvas: ${response.status} ${response.statusText}`);
    }
  }

  async saveSnapshot(name: string): Promise<{ name: string; elementCount: number; createdAt: string }> {
    const response = await fetch(`${this.serverUrl}/api/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Failed to save snapshot: ${response.status} ${response.statusText}`);
    }
    const result = await response.json() as any;
    return { name, elementCount: result.elementCount || 0, createdAt: result.createdAt || new Date().toISOString() };
  }

  async restoreSnapshot(name: string): Promise<ServerElement[]> {
    const response = await fetch(`${this.serverUrl}/api/snapshots/${encodeURIComponent(name)}`);
    if (!response.ok) {
      throw new Error(`Snapshot "${name}" not found`);
    }
    const data = await response.json() as {
      success: boolean;
      snapshot: { name: string; elements: ServerElement[]; createdAt: string };
    };
    // Clear current canvas and restore
    await this.clear();
    return await this.batchCreate(data.snapshot.elements);
  }

  /** Get the server URL (for canvas-only operations that need direct HTTP access) */
  getServerUrl(): string {
    return this.serverUrl;
  }
}
