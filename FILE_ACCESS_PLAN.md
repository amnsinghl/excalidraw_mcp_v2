# Feature: File-Based Storage Support (No Canvas Dependency)

## Problem

Currently, **every MCP tool** in v2 requires the Express canvas server (port 3000) to be running. If the canvas server is down, all operations fail with "HTTP server unavailable". This makes it impossible to use the MCP server for generating, editing, or exporting `.excalidraw` files without Docker or the canvas frontend.

## Solution

Introduce a **storage abstraction layer** so the MCP server can operate in two modes:

| Mode | Storage | Canvas Required | Use Case |
|------|---------|-----------------|----------|
| `canvas` | Express HTTP server (current) | Yes | Real-time collaboration, visual feedback |
| `file` | Local `.excalidraw` JSON file | No | CI/CD, scripting, offline, lightweight usage |

## Architecture

### Storage Backend Interface

```typescript
interface StorageBackend {
  createElement(element: ServerElement): Promise<ServerElement>;
  updateElement(id: string, updates: Partial<ServerElement>): Promise<ServerElement | null>;
  deleteElement(id: string): Promise<boolean>;
  getElement(id: string): Promise<ServerElement | null>;
  getAllElements(): Promise<ServerElement[]>;
  queryElements(type?: string, filter?: Record<string, any>): Promise<ServerElement[]>;
  batchCreate(elements: ServerElement[]): Promise<ServerElement[]>;
  clear(): Promise<void>;
  saveSnapshot(name: string): Promise<{ name: string; elementCount: number }>;
  restoreSnapshot(name: string): Promise<ServerElement[]>;
}
```

### Implementations

1. **`CanvasStorageBackend`** — Wraps existing HTTP calls to Express server (refactor of current inline `fetch` calls)
2. **`FileStorageBackend`** — In-memory element Map + auto-persists to `.excalidraw` JSON file on every write operation

### Configuration

| Env Variable | Values | Default | Description |
|---|---|---|---|
| `STORAGE_MODE` | `canvas`, `file` | `canvas` | Which backend to use |
| `EXCALIDRAW_FILE_PATH` | file path | `./drawing.excalidraw` | File path for file-mode storage |
| `EXPRESS_SERVER_URL` | URL | `http://localhost:3000` | Canvas server URL (canvas mode only) |
| `ENABLE_CANVAS_SYNC` | `true`/`false` | `true` | Existing flag, only relevant in canvas mode |

### Tool Compatibility Matrix

| Tool | File Mode | Canvas Mode | Notes |
|------|-----------|-------------|-------|
| `create_element` | ✅ | ✅ | |
| `update_element` | ✅ | ✅ | |
| `delete_element` | ✅ | ✅ | |
| `query_elements` | ✅ | ✅ | |
| `get_element` | ✅ | ✅ | |
| `batch_create_elements` | ✅ | ✅ | |
| `clear_canvas` | ✅ | ✅ | |
| `describe_scene` | ✅ | ✅ | |
| `export_scene` | ✅ | ✅ | |
| `import_scene` | ✅ | ✅ | |
| `group_elements` | ✅ | ✅ | |
| `ungroup_elements` | ✅ | ✅ | |
| `align_elements` | ✅ | ✅ | |
| `distribute_elements` | ✅ | ✅ | |
| `lock_elements` | ✅ | ✅ | |
| `unlock_elements` | ✅ | ✅ | |
| `duplicate_elements` | ✅ | ✅ | |
| `snapshot_scene` | ✅ | ✅ | Snapshots saved as separate files in file mode |
| `restore_snapshot` | ✅ | ✅ | |
| `get_resource` | ✅ | ✅ | |
| `read_diagram_guide` | ✅ | ✅ | No storage needed |
| `export_to_excalidraw_url` | ✅ | ✅ | Reads from storage, uploads to excalidraw.com |
| `create_from_mermaid` | ❌ | ✅ | Requires browser for conversion |
| `export_to_image` | ❌ | ✅ | Requires browser for rendering |
| `get_canvas_screenshot` | ❌ | ✅ | Requires browser for rendering |
| `set_viewport` | ❌ | ✅ | Requires browser |

**22 of 26 tools** work in file mode. The 4 canvas-only tools return a clear error in file mode.

## Implementation Plan

### Step 1: Create `StorageBackend` interface (`src/storage/types.ts`)
- Define the interface
- Define shared types

### Step 2: Create `FileStorageBackend` (`src/storage/file-backend.ts`)
- In-memory `Map<string, ServerElement>` for fast access
- Loads from `.excalidraw` file on init (if exists)
- Persists to file on every write (create/update/delete/clear/batch)
- Snapshot support via `{filename}.snapshot.{name}.excalidraw` files
- Query support with type filtering

### Step 3: Create `CanvasStorageBackend` (`src/storage/canvas-backend.ts`)
- Extract existing `fetch`-based logic from `index.ts` into this class
- Same interface, just wraps HTTP calls

### Step 4: Create backend factory (`src/storage/index.ts`)
- `createStorageBackend(mode)` factory function
- Reads `STORAGE_MODE` env var

### Step 5: Refactor `index.ts` to use `StorageBackend`
- Replace all inline `fetch` / `syncToCanvas` calls with storage backend methods
- Canvas-only tools check storage mode and return informative error in file mode
- Remove duplicated HTTP helper functions

### Step 6: Update environment/config
- Add new env vars to `.env.example`/docs
- Update README

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/storage/types.ts` | **New** | StorageBackend interface |
| `src/storage/file-backend.ts` | **New** | File-based storage implementation |
| `src/storage/canvas-backend.ts` | **New** | Canvas HTTP storage (refactored from index.ts) |
| `src/storage/index.ts` | **New** | Factory + re-exports |
| `src/index.ts` | **Modified** | Use storage backend instead of direct HTTP calls |
| `package.json` | **No change** | No new dependencies needed |

---

## Test Cases

### T1: FileStorageBackend — Basic CRUD

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T1.1 | Create element in file mode | Set `STORAGE_MODE=file`, call `create_element` with a rectangle | Element returned with ID, file written to disk with element |
| T1.2 | Get element by ID | Create element, then call `get_element` with its ID | Returns the exact element |
| T1.3 | Update element | Create element, call `update_element` to change x/y | Element updated in memory and on disk |
| T1.4 | Delete element | Create element, call `delete_element` | Element removed, file updated |
| T1.5 | Query elements by type | Create 2 rectangles and 1 arrow, query `type=rectangle` | Returns 2 rectangles only |
| T1.6 | Get all elements | Create 3 elements | Returns all 3 |

### T2: FileStorageBackend — File Persistence

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T2.1 | File created on first write | Start with no file, create element | `.excalidraw` file created on disk |
| T2.2 | File loads on init | Create elements, reinitialize backend from same file | All elements restored |
| T2.3 | File updated on every write | Create 3 elements, check file after each | File has 1, 2, 3 elements respectively |
| T2.4 | Custom file path | Set `EXCALIDRAW_FILE_PATH=/tmp/test.excalidraw` | File written to specified path |
| T2.5 | Invalid file path | Set path to `/nonexistent/dir/file.excalidraw` | Clear error message on first write |

### T3: FileStorageBackend — Batch & Clear

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T3.1 | Batch create | Call `batch_create_elements` with 5 elements | All 5 created, file has 5 elements |
| T3.2 | Clear canvas | Create elements, call `clear_canvas` | All elements removed, file has empty array |
| T3.3 | Import scene (replace) | Have existing elements, import new file in replace mode | Only imported elements remain |
| T3.4 | Import scene (merge) | Have 2 elements, import 3 more in merge mode | 5 total elements |

### T4: FileStorageBackend — Snapshots

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T4.1 | Save snapshot | Create elements, snapshot as "v1" | Snapshot file created: `*.snapshot.v1.excalidraw` |
| T4.2 | Restore snapshot | Save "v1", modify elements, restore "v1" | Elements match original state |
| T4.3 | Snapshot not found | Restore non-existent snapshot | Clear error message |

### T5: FileStorageBackend — Complex Operations

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T5.1 | Describe scene | Create rectangles and arrows, call `describe_scene` | Returns element summary, types, bounding box |
| T5.2 | Export scene to file | Create elements, `export_scene` with filePath | Valid `.excalidraw` JSON written |
| T5.3 | Align elements | Create 3 rectangles at different x, align left | All have same x coordinate |
| T5.4 | Distribute elements | Create 3 rectangles, distribute horizontally | Evenly spaced |
| T5.5 | Duplicate elements | Create element, duplicate with offset | New element at offset position |
| T5.6 | Group/ungroup | Create 2 elements, group them, then ungroup | GroupIds added then removed |
| T5.7 | Lock/unlock | Create element, lock it, then unlock | locked=true then locked=false |

### T6: Canvas-Only Tools in File Mode

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T6.1 | get_canvas_screenshot | Call in file mode | Error: "requires canvas mode" |
| T6.2 | export_to_image | Call in file mode | Error: "requires canvas mode" |
| T6.3 | set_viewport | Call in file mode | Error: "requires canvas mode" |
| T6.4 | create_from_mermaid | Call in file mode | Error: "requires canvas mode" |

### T7: CanvasStorageBackend — Backward Compatibility

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T7.1 | Default mode is canvas | Don't set STORAGE_MODE | Backend uses canvas HTTP calls |
| T7.2 | Existing tools work | Run create/update/delete/query with canvas server running | Same behavior as before |

### T8: Export — File Mode

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T8.1 | export_to_excalidraw_url | Create elements in file mode, export to URL | Elements read from file, uploaded to excalidraw.com |
| T8.2 | export_scene (stdout) | Create elements, export without filePath | JSON printed to response |
| T8.3 | export_scene (file) | Create elements, export with filePath | File written |

### Running Tests

```bash
# Run all tests
npm test

# Run with file mode
STORAGE_MODE=file npm test

# Run with specific test file  
npx vitest run tests/storage/file-backend.test.ts
npx vitest run tests/integration/file-mode.test.ts
```
