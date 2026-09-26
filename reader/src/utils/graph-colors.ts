/**
 * graph-colors.ts
 *
 * Universal, deterministic color palettes and hash-based color mapping for
 * graph visualization. Eliminates hardcoded author/tag mappings, ensuring
 * complete portability across any Substack publication or topic library.
 */

import type { GraphNode } from './graph-data';

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
 * Curated high-contrast constellation palette for topic/tag clusters.
 * 16 visually distinct, balanced hues designed for both dark and light modes.
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
 * Curated luminous palette for publication/author super-hubs.
 * Features warm and prominent focal anchors to visually ground constellations.
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
 * Curated architectural ink palette for light mode.
 * Rich, deep pigment inks (cobalt, deep indigo, forest/emerald, terracotta, deep purple, amber ochre)
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
 * Curated architectural palette for publication hubs in light mode.
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
 * Reading status color constants.
 */
export const READING_COLORS = {
  completed: 0x22c55e, // Green
  inProgress: 0xfacc15, // Yellow
  unreadDark: 0x475569, // Slate 600
  unreadLight: 0x94a3b8, // Slate 400
  nonPost: 0x64748b, // Slate 500
} as const;

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

/**
 * Determines topical accent color (24-bit integer) for any graph node.
 * Uses deterministic hashing for arbitrary author and tag names, eliminating hardcoded mappings.
 *
 * - Author nodes: assigned distinct warm/luminous hub colors from AUTHOR_PALETTE.
 * - Tag nodes: assigned vibrant colors from CONSTELLATION_PALETTE.
 * - Post nodes: inherit color from their primary tag, or author hub if tagless.
 * In Dark Mode: Uses luminous CONSTELLATION_PALETTE and AUTHOR_PALETTE for cosmic contrast.
 * In Light Mode: Uses ARCHITECTURAL_INK_PALETTE and ARCHITECTURAL_AUTHOR_PALETTE for clean paper contrast.
 *
 * @param node Partial graph node containing type, name, tags, and author
 * @param customTagMap Optional custom tag color overrides
 * @param customTagMapOrIsDark Optional custom tag map OR boolean indicating isDark
 * @param customAuthorMap Optional custom author color overrides
 * @param isDarkArg Boolean flag if customTagMap was provided as 2nd arg (defaults to true)
 * @returns 24-bit integer color code
 */
export function getNodeTopicColor(
  node: Pick<GraphNode, 'type' | 'name'> & { tags?: string[]; author?: string },
  customTagMapOrIsDark?: Record<string, number> | boolean,
  customAuthorMap?: Record<string, number>,
  isDarkArg: boolean = true
): number {
  let isDark = isDarkArg;
  let customTagMap: Record<string, number> | undefined;

  if (typeof customTagMapOrIsDark === 'boolean') {
    isDark = customTagMapOrIsDark;
    customTagMap = undefined;
  } else {
    customTagMap = customTagMapOrIsDark;
  }

  const palette = isDark ? CONSTELLATION_PALETTE : ARCHITECTURAL_INK_PALETTE;
  const authorPalette = isDark ? AUTHOR_PALETTE : ARCHITECTURAL_AUTHOR_PALETTE;

  if (node.type === 'author') {
    return getDeterministicColor(node.name, authorPalette, customAuthorMap);
  }

  // Determine tag key: primary tag if available, or tag node's own name, or author fallback
  let tagKey = '';
  if (node.type === 'tag') {
    tagKey = node.name.replace(/^#/, '');
  } else if (node.tags && node.tags.length > 0) {
    tagKey = node.tags[0].replace(/^#/, '');
  } else if (node.author) {
    // If post has no tags, cluster it visually with its author hub
    return getDeterministicColor(node.author, authorPalette, customAuthorMap);
  }

  return getDeterministicColor(tagKey, palette, customTagMap);
}

/**
 * Returns reading-status color code for post nodes.
 *
 * @param node Partial graph node containing type and readingStatus
 * @param isDark Whether the active UI theme is dark mode
 * @returns 24-bit integer color code
 */
export function getNodeReadingColor(
  node: Pick<GraphNode, 'type'> & { readingStatus?: 'unread' | 'in-progress' | 'completed' },
  isDark = true
): number {
  if (node.type !== 'post') return READING_COLORS.nonPost;
  if (node.readingStatus === 'completed') return READING_COLORS.completed;
  if (node.readingStatus === 'in-progress') return READING_COLORS.inProgress;
  return isDark ? READING_COLORS.unreadDark : READING_COLORS.unreadLight;
}

/**
 * Returns deterministic tag color metadata for dark and light modes.
 *
 * @param tag Tag name (with or without leading '#')
 * @returns Object with dark and light color hex strings, and CSS custom property style string
 */
export function getTagColors(tag: string): {
  dark: string;
  light: string;
  style: string;
} {
  const cleanTag = (tag || '').trim().replace(/^#/, '');
  const darkHex = hexToColorString(getNodeTopicColor({ type: 'tag', name: cleanTag }, true));
  const lightHex = hexToColorString(getNodeTopicColor({ type: 'tag', name: cleanTag }, false));
  return {
    dark: darkHex,
    light: lightHex,
    style: `--tag-color-dark: ${darkHex}; --tag-color-light: ${lightHex};`,
  };
}

