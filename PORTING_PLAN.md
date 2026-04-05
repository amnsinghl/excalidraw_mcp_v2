# Porting Plan: excalidraw-mcp (Python) → excalidraw_mcp_v2 (TypeScript)

## Feature Gap Analysis

### What v2 already has that Python doesn't

| Capability | v2 (TS) | Python |
|---|---|---|
| Live persistent canvas + WebSocket sync | ✅ | ❌ (generates files) |
| Element-level CRUD (create/update/delete) | ✅ | ❌ |
| Visual feedback (`describe_scene`, `get_canvas_screenshot`) | ✅ | ❌ |
| Align / distribute / group / lock tools | ✅ | ❌ |
| Snapshots (save/restore) | ✅ | ❌ |
| Shareable excalidraw.com URLs | ✅ | ❌ |
| Viewport / camera control | ✅ | ❌ |
| Real-time multi-client sync | ✅ | ❌ |
| Design guide tool | ✅ | ❌ |

### What Python has that v2 is missing (porting targets)

| Category | Features | Complexity |
|---|---|---|
| **Layout Algorithms** | Sugiyama hierarchical layout (via `grandalf`), Grid layout, Layered layout | 🔴 High |
| **24 Diagram Generators** | Flowchart, Sequence, Architecture, Mindmap, ER, Class, State, Timeline, Pie/Bar/Line chart, Kanban, Network, Quadrant, Radar, User Journey, Wireframe, Org Chart, SWOT, Table, Decision Tree | 🔴 High |
| **Element Primitives** | `create_labeled_shape` (shape+text with mutual binding), `create_centered_title`, `create_group_frame` | 🟡 Medium |
| **Text Utilities** | CJK-aware `estimate_text_width` (CJK=1.1×, ASCII=0.62×) | 🟢 Low |
| **Color System** | 80+ tech-specific colors (redis, postgres, docker, k8s, react, python, etc.) | 🟢 Low |
| **Unified Router** | Single `create_diagram` tool that auto-dispatches to the right generator | 🟡 Medium |
| **Read/Modify Diagrams** | `read_diagram` (parse .excalidraw), `modify_diagram` (add/remove nodes) | 🟡 Medium |
| **SVG Export** | Server-side SVG export (no browser needed) | 🟡 Medium |
| **Mermaid (extended)** | Python supports flowchart, sequence, class, state, pie → Excalidraw natively (not just via library) | 🟡 Medium |

---

## Phase 1: Foundation Layer (Elements + Layout)

**Goal:** Port the building blocks that all diagram generators depend on.

### 1.1 — Element Primitives (`src/elements/`)

| File | Port From | Key Functions |
|---|---|---|
| `shapes.ts` | `elements/shapes.py` | `createRectangle()`, `createEllipse()`, `createDiamond()` |
| `text.ts` | `elements/text.py` | `estimateTextWidth()` (CJK-aware), `createText()`, `createLabeledShape()`, `createCenteredTitle()` |
| `arrows.ts` | `elements/arrows.py` | `createArrow()` with auto side-detection, elbow routing, binding |
| `lines.ts` | `elements/lines.py` | `createLine()` |
| `groups.ts` | `elements/groups.py` | `createGroupFrame()` — dashed background rectangle with label |
| `style.ts` | `elements/style.py` | `COLORS` (8 basic), `TECH_COLORS` (80+), `getColor()` with fallback |

These are pure functions producing JSON objects — straightforward 1:1 port. v2 already has `ExcalidrawElement` types in `src/types.ts`.

### 1.2 — Layout Algorithms (`src/layout/`)

| File | Port From | Algorithm |
|---|---|---|
| `sugiyama.ts` | `layout/sugiyama.py` | Sugiyama hierarchical — cycle detection, layer assignment, crossing minimization, coordinate assignment |
| `grid.ts` | `layout/grid.py` | Grid layout (row/col major) + Layered layout (stacked horizontal layers) |

**Key decision:** Python uses `grandalf`. TS options:
- **Option A (recommended):** Use `dagre` — most popular JS graph layout, same Sugiyama algorithm
- **Option B:** Use `elkjs` — more powerful but heavier
- **Option C:** Hand-port the grandalf wrapper — more work, more control

### 1.3 — Utility Functions (`src/utils/`)

| File | Port From | Functions |
|---|---|---|
| `ids.ts` | `utils/ids.py` | `genId()` — random 10-char alphanumeric |
| `svg-export.ts` | `utils/svg_export.py` | Server-side SVG export without browser |

---

## Phase 2: Diagram Generators (Tools)

**Goal:** Port each diagram type as a new MCP tool. Each tool composes Phase 1 primitives.

Each generator follows: **parse input → create elements → layout → connect → title → serialize**.

In v2, instead of saving to a file, the tool pushes elements to the live canvas via `batch_create_elements` / POST `/api/elements/batch`.

### Tier 1 — High-value, high-usage (port first)

| # | Tool | Port From | Notes |
|---|---|---|---|
| 1 | `create_flowchart` | `tools/flowchart.py` | Most used, Sugiyama layout. 4 directions, branches, cycles, groups |
| 2 | `create_sequence_diagram` | `tools/sequence.py` | UML-style, custom manual layout (lifelines + messages) |
| 3 | `create_architecture_diagram` | `tools/architecture.py` | Layered layout, tier-based systems |
| 4 | `create_er_diagram` | `tools/er_diagram.py` | Entity-relationship with cardinality |
| 5 | `create_class_diagram` | `tools/class_diagram.py` | UML class diagrams |

### Tier 2 — Medium-value (port second)

| # | Tool | Port From | Notes |
|---|---|---|---|
| 6 | `create_mindmap` | `tools/mindmap.py` | Tree layout, color cycling |
| 7 | `create_org_chart` | `tools/org_chart.py` | Top-down hierarchy |
| 8 | `create_kanban_board` | `tools/kanban.py` | Column + card layout |
| 9 | `create_state_diagram` | `tools/state_diagram.py` | State machines with initial/final states |
| 10 | `create_decision_tree` | `tools/decision_tree.py` | Diamond decision nodes |
| 11 | `create_table` | `tools/table.py` | Auto-sized columns |

### Tier 3 — Charts (port third)

| # | Tool | Port From | Notes |
|---|---|---|---|
| 12 | `create_pie_chart` | `tools/pie_chart.py` | Trigonometric slice calculation |
| 13 | `create_bar_chart` | `tools/bar_chart.py` | Auto-scaled axes |
| 14 | `create_line_chart` | `tools/line_chart.py` | Multi-series, legends |
| 15 | `create_radar_chart` | `tools/radar.py` | Concentric polygon math |
| 16 | `create_quadrant_chart` | `tools/quadrant.py` | 2×2 matrix |

### Tier 4 — Specialized (port last)

| # | Tool | Port From | Notes |
|---|---|---|---|
| 17 | `create_timeline` | `tools/timeline.py` | Gantt-style bars |
| 18 | `create_network_diagram` | `tools/network.py` | Typed nodes (server/DB/firewall) |
| 19 | `create_wireframe` | `tools/wireframe.py` | Device frames + UI components |
| 20 | `create_user_journey` | `tools/user_journey.py` | Emotion indicators |
| 21 | `create_swot_analysis` | `tools/swot.py` | Color-coded 2×2 |

---

## Phase 3: Meta Tools & Integration

| Tool | Port From | Description |
|---|---|---|
| `create_diagram` (unified router) | `tools/unified.py` | Single entry point — accepts `type: "flowchart"` and dispatches to the right generator |
| `read_diagram` | `tools/read.py` | Parse .excalidraw file → structured description (v2's `describe_scene` covers live canvas but not files) |
| `modify_diagram` | `tools/modify.py` | Add/remove nodes from existing diagrams intelligently (v2 has CRUD but no semantic "add a node to this flowchart") |
| `list_diagram_types` | `tools/help.py` | Extend `read_diagram_guide` with the full list of available generators |

---

## Phase 4: Integration with v2's Live Canvas

Each ported generator needs to:

1. Generate the element array (same as Python)
2. Push elements to the canvas via `batch_create_elements` (POST `/api/elements/batch`)
3. Optionally call `set_viewport` to auto-fit the new diagram
4. Return a success response with element count + bounding box

This is a thin adapter layer — each generator returns `ExcalidrawElement[]`, and a shared `pushToCanvas()` utility handles the rest.

---

## Recommended File Structure

```
src/
├── elements/           # Phase 1.1 — Element primitives
│   ├── shapes.ts
│   ├── text.ts
│   ├── arrows.ts
│   ├── lines.ts
│   ├── groups.ts
│   └── style.ts
├── layout/             # Phase 1.2 — Layout algorithms
│   ├── sugiyama.ts     # (uses dagre)
│   └── grid.ts
├── diagrams/           # Phase 2 — Diagram generators
│   ├── flowchart.ts
│   ├── sequence.ts
│   ├── architecture.ts
│   ├── er-diagram.ts
│   ├── class-diagram.ts
│   ├── mindmap.ts
│   ├── org-chart.ts
│   ├── kanban.ts
│   ├── state-diagram.ts
│   ├── decision-tree.ts
│   ├── table.ts
│   ├── pie-chart.ts
│   ├── bar-chart.ts
│   ├── line-chart.ts
│   ├── radar.ts
│   ├── quadrant.ts
│   ├── timeline.ts
│   ├── network.ts
│   ├── wireframe.ts
│   ├── user-journey.ts
│   ├── swot.ts
│   └── index.ts        # Unified router
├── index.ts            # Existing — register new tools here
├── server.ts           # Existing — add REST endpoints for generators
├── types.ts            # Existing — extend with diagram input types
└── utils/
    ├── logger.ts       # Existing
    ├── ids.ts          # New — ID generation
    └── canvas.ts       # New — pushToCanvas() adapter
```

## New Dependencies

```json
{
  "dagre": "^0.8.5",
  "@types/dagre": "^0.7.52"
}
```

## Estimated Scope

| Phase | Files | Lines (approx) |
|---|---|---|
| Phase 1 (Foundation) | ~9 files | ~1,500 lines |
| Phase 2 Tier 1 (Core diagrams) | ~5 files | ~2,000 lines |
| Phase 2 Tier 2 (Medium) | ~6 files | ~1,800 lines |
| Phase 2 Tier 3 (Charts) | ~5 files | ~1,500 lines |
| Phase 2 Tier 4 (Specialized) | ~5 files | ~1,200 lines |
| Phase 3 (Meta tools) | ~4 files | ~500 lines |
| Phase 4 (Integration) | ~2 files + edits | ~300 lines |
| **Total** | **~36 files** | **~8,800 lines** |

## Key Technical Decisions Needed

1. **Sugiyama library:** `dagre` (recommended) vs `elkjs` vs hand-port
2. **Tool registration:** Register all 24+ new tools individually, or expose a single `create_diagram` unified tool?
3. **Output mode:** Should generators also support file output (like Python), or only push to the live canvas?
4. **Test strategy:** Port the 30+ Python test files to Jest/Vitest, or write new tests?
