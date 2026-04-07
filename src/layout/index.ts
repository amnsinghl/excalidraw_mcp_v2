/**
 * Layout engine barrel export.
 */

export { estimateTextWidth, computeBoxWidth, BOX_PADDING, MIN_BOX_WIDTH, DEFAULT_BOX_HEIGHT, DEFAULT_FONT_SIZE } from './text.js';
export { sugiyamaLayout, type Direction, type SugiyamaNode, type SugiyamaEdge, type PositionedNode } from './sugiyama.js';
export { gridLayout, layeredLayout, type GridNode, type PositionedGridNode, type LayerDef, type PositionedLayerNode } from './grid.js';
export { orgChartLayout, mindmapLayout, type TreeNode, type PositionedTreeNode } from './tree.js';
export { computeArrowLayout, autoSides, FIXED_POINTS, type ArrowLayout, type BoundingBox, type Side } from './arrows.js';
export { computeGroupFrame, type GroupFrameLayout, type NodeBounds } from './groups.js';
export { getColor, COLORS, TECH_COLORS, type ColorPair } from './style.js';
