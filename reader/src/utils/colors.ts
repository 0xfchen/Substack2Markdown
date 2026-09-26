/**
 * colors.ts
 *
 * Centralized color registry and design tokens for 3D WebGL scenes (Knowledge Graph,
 * 404 Aerospace Scene) and reading tracker stoplight triage.
 *
 * Provides a single source of truth for numeric hex integers, palette arrays,
 * and deterministic color-mapping functions.
 */

// ============================================================================
// 1. Color Hashing & String Conversion Utilities
// ============================================================================

/**
 * 32-bit FNV-1a hash algorithm for fast, uniform, deterministic string hashing.
 *
 * @param str Input string to hash
 * @returns 32-bit unsigned integer hash
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Converts a 24-bit integer hex color (e.g. 0x38bdf8) to a CSS hex string (e.g. "#38bdf8").
 *
 * @param hex 24-bit numeric hex code
 * @returns 7-character CSS hex string prefixed with '#'
 */
export function hexToColorString(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, '0')}`;
}

/**
 * Converts a CSS hex string (e.g. "#38bdf8" or "38bdf8") to a 24-bit integer hex number.
 *
 * @param str CSS hex string
 * @returns 24-bit numeric hex code
 */
export function colorStringToHex(str: string): number {
  if (!str) return CONSTELLATION_PALETTE[0];
  const clean = str.replace('#', '').trim();
  const parsed = parseInt(clean, 16);
  return Number.isNaN(parsed) ? CONSTELLATION_PALETTE[0] : parsed;
}

/**
 * Returns a deterministic color number from a palette based on a string's hash.
 * Supports an optional custom override map for branded tags or publications.
 *
 * @param key String identifier (e.g. tag name, author name)
 * @param palette Readonly array of 24-bit integer color codes
 * @param customMap Optional dictionary of explicit color overrides
 * @returns 24-bit integer color code
 */
export function getDeterministicColor(
  key: string,
  palette: readonly number[] = CONSTELLATION_PALETTE,
  customMap?: Record<string, number>
): number {
  const normalized = (key || '').trim().toLowerCase();
  if (customMap && customMap[normalized] !== undefined) {
    return customMap[normalized];
  }
  if (!normalized) return palette[0];
  const hash = hashString(normalized);
  return palette[hash % palette.length];
}

// ============================================================================
// 2. Reading Status Stoplight Colors
// ============================================================================

export const READING_COLORS = {
  completed: 0x22c55e, // Emerald Green
  inProgress: 0xfacc15, // Amber Yellow
  toReadDark: 0xff453a, // Coral Red (Dark Mode)
  toReadLight: 0xe11d48, // Rose / Coral Red (Light Mode)
  toRead: 0xf43f5e, // Rose / Coral fallback
  unreadDark: 0x475569, // Slate 600
  unreadLight: 0x94a3b8, // Slate 400
  nonPost: 0x64748b, // Slate 500
} as const;

// ============================================================================
// 3. Knowledge Graph Clustering Palettes
// ============================================================================

/**
 * Curated high-contrast constellation palette for topic/tag clusters (Dark Mode).
 * 16 visually distinct, balanced hues designed for cosmic contrast.
 */
export const CONSTELLATION_PALETTE: readonly number[] = [
  0x38bdf8, // Sky Blue
  0x818cf8, // Indigo
  0x34d399, // Emerald
  0xf472b6, // Pink
  0xfbbf24, // Amber
  0xa78bfa, // Violet
  0x2dd4bf, // Teal
  0xf87171, // Rose
  0x38e1b0, // Mint
  0xc084fc, // Purple
  0xfb923c, // Orange
  0x60a5fa, // Blue
  0xa3e635, // Lime
  0xe879f9, // Fuchsia
  0x22d3ee, // Cyan
  0x4ade80, // Green
] as const;

/**
 * Curated luminous palette for publication/author super-hubs (Dark Mode).
 * Warm and prominent focal anchors to visually ground constellations.
 */
export const AUTHOR_PALETTE: readonly number[] = [
  0xf59e0b, // Amber Gold
  0x0ea5e9, // Electric Sky
  0xec4899, // Hot Pink
  0x10b981, // Vivid Emerald
  0x8b5cf6, // Deep Violet
  0xf97316, // Bright Orange
  0x06b6d4, // Vivid Cyan
  0xd946ef, // Radiant Magenta
  0x3b82f6, // Royal Blue
  0xeab308, // Sun Yellow
] as const;

/**
 * Curated architectural ink palette for topic nodes (Light Mode).
 * Rich, deep pigment inks (cobalt, deep indigo, forest/emerald, terracotta)
 * designed to look like technical blueprint and fountain-pen ink on paper.
 */
export const ARCHITECTURAL_INK_PALETTE: readonly number[] = [
  0x0369a1, // Deep Sky / Drafting Cobalt
  0x4338ca, // Deep Indigo
  0x047857, // Deep Emerald Ink
  0xbe185d, // Crimson Rose
  0xb45309, // Amber Ochre
  0x6d28d9, // Deep Violet
  0x0f766e, // Deep Pine Teal
  0xb91c1c, // Crimson Ink
  0x0284c7, // Architectural Blue
  0x7c3aed, // Royal Purple
  0xc2410c, // Terracotta Rust
  0x1d4ed8, // Blueprint Blue
  0x4d7c0f, // Olive Sage
  0xa21caf, // Deep Fuchsia
  0x0e7490, // Deep Cyan
  0x15803d, // Forest Green
] as const;

/**
 * Curated architectural palette for publication hubs (Light Mode).
 * Warm bronze ochre, rich indigo, deep emerald, and wine anchors for paper aesthetics.
 */
export const ARCHITECTURAL_AUTHOR_PALETTE: readonly number[] = [
  0xd97706, // Rich Bronze Ochre
  0x0284c7, // Blueprint Cobalt
  0xbe185d, // Crimson Wine
  0x059669, // Forest Ink
  0x7c3aed, // Imperial Purple
  0xc2410c, // Terracotta
  0x0f766e, // Deep Pine
  0xa21caf, // Deep Magenta
  0x1d4ed8, // Blueprint Blue
  0xb45309, // Warm Ochre
] as const;

/**
 * 3D Knowledge Graph Scene Ambience & Link Colors
 */
export const GRAPH_SCENE_COLORS = {
  linksDark: 0x334155, // Slate 700
  linksLight: 0x94a3b8, // Slate 400
  linksLightFaint: 0xcbd5e1, // Slate 300
  activeLinkDark: 0x38bdf8, // Sky 400
  activeLinkLight: 0x0284c7, // Sky 600
  dirLightDark: 0x38bdf8, // Sky 400
  dirLightLight: 0xe2e8f0, // Slate 200
  starMatDark: 0x93c5fd, // Sky 300
  starMatLight: 0x64748b, // Slate 500
} as const;

// ============================================================================
// 4. Aerospace 404 Scene Colors (Starship, Origami Plane, Space Rig)
// ============================================================================

export const AEROSPACE_404_COLORS = {
  // Vessel materials
  chromeDark: 0xe2e8f0, // Slate 200
  chromeLight: 0xffffff, // Pure White
  engineBell: 0x1e293b, // Slate 800
  seam: 0x64748b, // Slate 500
  plume: 0x38bdf8, // Sky Blue
  corePlume: 0xffffff, // Pure White core
  creaseLines: 0x334155, // Slate 700

  // Lighting rig
  ambientLight: 0xffffff,
  keyLight: 0xffffff,
  fillLight: 0xe2e8f0,
  rimLightLDark: 0x38bdf8,
  rimLightLLight: 0x93c5fd,
  rimLightR: 0xe0f2fe,
  topLight: 0xffffff,
  engineLight: 0x38bdf8,

  // Starfield & Motes
  starMotesDark: 0x7dd3fc,
  starMotesLight: 0x94a3b8,

  // Paper plane textures & typography
  paperBase: '#f8f6f0',
  paperRuling: 'rgba(70, 110, 180, 0.20)',
  paperMargin: 'rgba(239, 68, 68, 0.22)',
  paperFront: 0xede9e1,
  paperSide: 0xcbd5e1,

  // 2D Canvas Starfield RGB bases
  starfieldBlueDark: '186, 230, 253',
  starfieldGoldDark: '254, 240, 138',
  starfieldBlueLight: '56, 189, 248',
  starfieldGoldLight: '234, 179, 8',
  starfieldMoteLight: '100, 116, 139',
} as const;

