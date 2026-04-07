/**
 * Color presets for diagram elements.
 * Ported from excalidraw-mcp elements/style.py
 */

export interface ColorPair {
  bg: string;
  stroke: string;
}

export const COLORS: Record<string, ColorPair> = {
  blue:   { bg: "#a5d8ff", stroke: "#1971c2" },
  green:  { bg: "#b2f2bb", stroke: "#2f9e44" },
  purple: { bg: "#d0bfff", stroke: "#7048e8" },
  yellow: { bg: "#ffec99", stroke: "#e8590c" },
  red:    { bg: "#ffc9c9", stroke: "#e03131" },
  gray:   { bg: "#dee2e6", stroke: "#495057" },
  orange: { bg: "#ffd8a8", stroke: "#e8590c" },
  pink:   { bg: "#fcc2d7", stroke: "#c2255c" },
};

export const TECH_COLORS: Record<string, ColorPair> = {
  redis:          { bg: "#ffc9c9", stroke: "#c92a2a" },
  postgres:       { bg: "#a5d8ff", stroke: "#1864ab" },
  postgresql:     { bg: "#a5d8ff", stroke: "#1864ab" },
  mysql:          { bg: "#a5d8ff", stroke: "#1971c2" },
  mongodb:        { bg: "#b2f2bb", stroke: "#2b8a3e" },
  elasticsearch:  { bg: "#ffe066", stroke: "#e67700" },
  kafka:          { bg: "#1e1e1e", stroke: "#495057" },
  rabbitmq:       { bg: "#ffd8a8", stroke: "#e8590c" },
  nats:           { bg: "#b2f2bb", stroke: "#087f5b" },
  aws:            { bg: "#ffd8a8", stroke: "#d9480f" },
  gcp:            { bg: "#a5d8ff", stroke: "#1971c2" },
  azure:          { bg: "#a5d8ff", stroke: "#1864ab" },
  docker:         { bg: "#a5d8ff", stroke: "#1971c2" },
  kubernetes:     { bg: "#a5d8ff", stroke: "#1864ab" },
  k8s:            { bg: "#a5d8ff", stroke: "#1864ab" },
  react:          { bg: "#d0ebff", stroke: "#1c7ed6" },
  vue:            { bg: "#b2f2bb", stroke: "#2f9e44" },
  angular:        { bg: "#ffc9c9", stroke: "#c92a2a" },
  nextjs:         { bg: "#dee2e6", stroke: "#212529" },
  svelte:         { bg: "#ffd8a8", stroke: "#e8590c" },
  python:         { bg: "#ffe066", stroke: "#1864ab" },
  node:           { bg: "#b2f2bb", stroke: "#2f9e44" },
  nodejs:         { bg: "#b2f2bb", stroke: "#2f9e44" },
  go:             { bg: "#d0ebff", stroke: "#1c7ed6" },
  golang:         { bg: "#d0ebff", stroke: "#1c7ed6" },
  rust:           { bg: "#ffd8a8", stroke: "#e8590c" },
  java:           { bg: "#ffc9c9", stroke: "#c92a2a" },
  nginx:          { bg: "#b2f2bb", stroke: "#087f5b" },
  graphql:        { bg: "#fcc2d7", stroke: "#a61e4d" },
  grpc:           { bg: "#d0ebff", stroke: "#1c7ed6" },
};

export function getColor(name: string): ColorPair {
  const c = COLORS[name];
  if (c) return c;
  const lower = name.toLowerCase();
  const tc = TECH_COLORS[lower];
  if (tc) return tc;
  return { bg: "#a5d8ff", stroke: "#1971c2" };
}
