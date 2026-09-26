/**
 * graph-colors.ts
 *
 * Universal, deterministic color palettes and hash-based color mapping for
 * graph visualization. Re-exports primitives from central colors registry
 * and provides graph-node-specific coloring functions.
 */

import type { GraphNode } from './graph-data';
import {
  hashString,
  hexToColorString,
  colorStringToHex,
  getDeterministicColor,
  CONSTELLATION_PALETTE,
  AUTHOR_PALETTE,
  ARCHITECTURAL_INK_PALETTE,
  ARCHITECTURAL_AUTHOR_PALETTE,
  READING_COLORS,
} from './colors';

export {
  hashString,
  hexToColorString,
  colorStringToHex,
  getDeterministicColor,
  CONSTELLATION_PALETTE,
  AUTHOR_PALETTE,
  ARCHITECTURAL_INK_PALETTE,
  ARCHITECTURAL_AUTHOR_PALETTE,
  READING_COLORS,
};


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
  node: Pick<GraphNode, 'type'> & { readingStatus?: 'unread' | 'pending' | 'in-progress' | 'completed' },
  isDark = true
): number {
  if (node.type !== 'post') return READING_COLORS.nonPost;
  if (node.readingStatus === 'completed') return READING_COLORS.completed;
  if (node.readingStatus === 'in-progress') return READING_COLORS.inProgress;
  if (node.readingStatus === 'pending') return isDark ? READING_COLORS.toReadDark : READING_COLORS.toReadLight;
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

