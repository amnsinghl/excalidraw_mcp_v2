export type { StorageBackend } from './types.js';
export { FileStorageBackend } from './file-backend.js';
export { CanvasStorageBackend } from './canvas-backend.js';

import { StorageBackend } from './types.js';
import { FileStorageBackend } from './file-backend.js';
import { CanvasStorageBackend } from './canvas-backend.js';
import logger from '../utils/logger.js';

export type StorageMode = 'canvas' | 'file';

export function createStorageBackend(): StorageBackend {
  const mode = (process.env.STORAGE_MODE || 'canvas').toLowerCase() as StorageMode;

  if (mode === 'file') {
    const filePath = process.env.EXCALIDRAW_FILE_PATH || './drawing.excalidraw';
    logger.info(`Storage mode: file (${filePath})`);
    return new FileStorageBackend(filePath);
  }

  const serverUrl = process.env.EXPRESS_SERVER_URL || 'http://localhost:3000';
  logger.info(`Storage mode: canvas (${serverUrl})`);
  return new CanvasStorageBackend(serverUrl);
}
