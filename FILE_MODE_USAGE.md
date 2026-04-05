# File Mode Usage Guide

## Overview

The MCP server supports two storage modes:

| Mode | Description | Canvas Server Required |
|------|-------------|----------------------|
| **`canvas`** (default) | Elements stored on the Express canvas server with live WebSocket sync | Yes |
| **`file`** | Elements stored in a local `.excalidraw` JSON file | No |

File mode lets you use 22 of 26 MCP tools **without running the canvas server or Docker**. Ideal for CI/CD pipelines, scripting, offline usage, or lightweight workflows.

---

## Quick Start

### 1. Set Environment Variables

```bash
# Switch to file mode
export STORAGE_MODE=file

# Optional: custom file path (default: ./drawing.excalidraw)
export EXCALIDRAW_FILE_PATH=/path/to/my-diagram.excalidraw
```

### 2. Run the MCP Server

```bash
npm run start
```

That's it. No canvas server, no Docker, no browser needed.

---

## Configuration

| Variable | Values | Default | Description |
|---|---|---|---|
| `STORAGE_MODE` | `canvas` / `file` | `canvas` | Storage backend to use |
| `EXCALIDRAW_FILE_PATH` | Any file path | `./drawing.excalidraw` | File path for file mode |
| `EXPRESS_SERVER_URL` | URL | `http://localhost:3000` | Canvas server URL (canvas mode only) |

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/path/to/excalidraw_mcp_v2/dist/index.js"],
      "env": {
        "STORAGE_MODE": "file",
        "EXCALIDRAW_FILE_PATH": "/tmp/my-diagram.excalidraw"
      }
    }
  }
}
```

### Cursor / Codex CLI

Set the environment variables before running the MCP server, or add them to your `.env` file:

```env
STORAGE_MODE=file
EXCALIDRAW_FILE_PATH=./output/diagram.excalidraw
```

---

## Tool Compatibility

### Works in File Mode (22 tools)

| Tool | Description |
|------|-------------|
| `create_element` | Create a shape, text, arrow, or line |
| `update_element` | Modify element properties |
| `delete_element` | Remove an element |
| `get_element` | Get element by ID |
| `query_elements` | Search elements by type or filter |
| `batch_create_elements` | Create many elements at once |
| `clear_canvas` | Remove all elements |
| `describe_scene` | Get AI-readable scene description |
| `export_scene` | Export to `.excalidraw` JSON |
| `import_scene` | Import from `.excalidraw` JSON (replace or merge) |
| `group_elements` | Group elements together |
| `ungroup_elements` | Ungroup elements |
| `align_elements` | Align elements (left/center/right/top/middle/bottom) |
| `distribute_elements` | Distribute elements evenly |
| `lock_elements` | Lock elements |
| `unlock_elements` | Unlock elements |
| `duplicate_elements` | Clone elements with offset |
| `snapshot_scene` | Save named snapshot |
| `restore_snapshot` | Restore from snapshot |
| `get_resource` | Get scene state or elements |
| `read_diagram_guide` | Get design guide and best practices |
| `export_to_excalidraw_url` | Upload to excalidraw.com and get shareable URL |

### Requires Canvas Mode (4 tools)

These tools need a browser/frontend and will return a clear error in file mode:

| Tool | Reason |
|------|--------|
| `get_canvas_screenshot` | Needs browser to render PNG |
| `export_to_image` | Needs browser to render PNG/SVG |
| `set_viewport` | Needs browser for zoom/pan |
| `create_from_mermaid` | Needs browser for Mermaid library |

---

## Examples

### Example 1: Create a Simple Diagram

```bash
export STORAGE_MODE=file
export EXCALIDRAW_FILE_PATH=./architecture.excalidraw
npm run start
```

Then via MCP tools:

```
1. create_element: { type: "rectangle", x: 100, y: 100, width: 200, height: 80, text: "Frontend" }
2. create_element: { type: "rectangle", x: 100, y: 300, width: 200, height: 80, text: "Backend" }
3. create_element: { type: "arrow", x: 200, y: 180, startElementId: "<frontend-id>", endElementId: "<backend-id>" }
4. export_scene: { filePath: "./architecture.excalidraw" }
```

The file is auto-saved on every operation. Open it in [excalidraw.com](https://excalidraw.com) or any Excalidraw-compatible viewer.

### Example 2: Batch Create and Export URL

```
1. batch_create_elements: { elements: [ ... array of shapes and arrows ... ] }
2. export_to_excalidraw_url: {}
   → Returns: https://excalidraw.com/#json=abc123,keyXYZ
```

### Example 3: Snapshot Workflow

```
1. batch_create_elements: { elements: [...] }
2. snapshot_scene: { name: "v1" }
3. clear_canvas: {}
4. batch_create_elements: { elements: [...different...] }
5. restore_snapshot: { name: "v1" }  ← rolls back to v1
```

In file mode, snapshots are saved as separate files:
```
my-diagram.excalidraw                    ← main file
my-diagram.snapshot.v1.excalidraw        ← snapshot "v1"
my-diagram.snapshot.draft.excalidraw     ← snapshot "draft"
```

### Example 4: Import Existing Diagram

```
1. import_scene: { filePath: "./existing-diagram.excalidraw", mode: "replace" }
2. describe_scene: {}  ← see what was imported
3. update_element: { id: "some-id", text: "Updated Label" }
4. export_scene: { filePath: "./modified-diagram.excalidraw" }
```

---

## File Format

The `.excalidraw` file is standard Excalidraw JSON, directly openable at [excalidraw.com](https://excalidraw.com):

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "mcp-excalidraw-server",
  "elements": [ ... ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": null
  },
  "files": {}
}
```

---

## Switching Between Modes

You can switch modes at any time by changing the `STORAGE_MODE` env var and restarting:

```bash
# Start in file mode, create a diagram
STORAGE_MODE=file EXCALIDRAW_FILE_PATH=./diagram.excalidraw npm run start

# Later, import that file into the live canvas
STORAGE_MODE=canvas npm run start
# Then use: import_scene { filePath: "./diagram.excalidraw", mode: "replace" }
```

---

## Running Tests

```bash
# Run all file-backend tests (no canvas server needed)
npm test

# Watch mode
npm run test:watch
```
