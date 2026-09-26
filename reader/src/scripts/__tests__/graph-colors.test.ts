import { describe, it, expect } from 'vitest';
import {
  hashString,
  hexToColorString,
  colorStringToHex,
  getDeterministicColor,
  getNodeTopicColor,
  getNodeReadingColor,
  getTagColors,
  CONSTELLATION_PALETTE,
  AUTHOR_PALETTE,
  ARCHITECTURAL_INK_PALETTE,
  ARCHITECTURAL_AUTHOR_PALETTE,
  READING_COLORS,
} from '../../utils/graph-colors';

describe('graph-colors utility', () => {
  describe('hashString()', () => {
    it('generates consistent 32-bit hashes', () => {
      const hash1 = hashString('engineering');
      const hash2 = hashString('engineering');
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('number');
      expect(hash1).toBeGreaterThanOrEqual(0);
    });

    it('produces different hashes for different strings', () => {
      expect(hashString('engineering')).not.toBe(hashString('leadership'));
      expect(hashString('alice')).not.toBe(hashString('bob'));
    });
  });

  describe('hex and color string conversions', () => {
    it('converts number to hex string with padding', () => {
      expect(hexToColorString(0x38bdf8)).toBe('#38bdf8');
      expect(hexToColorString(0x00ff00)).toBe('#00ff00');
      expect(hexToColorString(0x000000)).toBe('#000000');
    });

    it('converts hex string to number', () => {
      expect(colorStringToHex('#38bdf8')).toBe(0x38bdf8);
      expect(colorStringToHex('38bdf8')).toBe(0x38bdf8);
      expect(colorStringToHex('#00ff00')).toBe(0x00ff00);
    });

    it('handles invalid hex strings gracefully with fallback', () => {
      expect(colorStringToHex('')).toBe(CONSTELLATION_PALETTE[0]);
      expect(colorStringToHex('not-a-color')).toBe(CONSTELLATION_PALETTE[0]);
    });
  });

  describe('getDeterministicColor()', () => {
    it('maps keys to colors within the provided palette', () => {
      const color1 = getDeterministicColor('systems', CONSTELLATION_PALETTE);
      const color2 = getDeterministicColor('systems', CONSTELLATION_PALETTE);
      expect(color1).toBe(color2);
      expect(CONSTELLATION_PALETTE).toContain(color1);
    });

    it('is case-insensitive and ignores surrounding whitespace', () => {
      const color1 = getDeterministicColor('Machine Learning');
      const color2 = getDeterministicColor('  machine learning  ');
      expect(color1).toBe(color2);
    });

    it('honors custom map overrides when provided', () => {
      const customMap = { special: 0xff00ff };
      expect(getDeterministicColor('special', CONSTELLATION_PALETTE, customMap)).toBe(0xff00ff);
      expect(getDeterministicColor('other', CONSTELLATION_PALETTE, customMap)).not.toBe(0xff00ff);
    });
  });

  describe('getNodeTopicColor()', () => {
    it('deterministically colors authors from AUTHOR_PALETTE', () => {
      const authorAlice = { type: 'author' as const, name: 'Alice Walker' };
      const authorBob = { type: 'author' as const, name: 'Bob Smith' };

      const colorAlice = getNodeTopicColor(authorAlice);
      const colorBob = getNodeTopicColor(authorBob);

      expect(AUTHOR_PALETTE).toContain(colorAlice);
      expect(AUTHOR_PALETTE).toContain(colorBob);
      // Both authors are deterministic
      expect(getNodeTopicColor(authorAlice)).toBe(colorAlice);
    });

    it('deterministically colors tag nodes from CONSTELLATION_PALETTE', () => {
      const tagNode = { type: 'tag' as const, name: '#systems' };
      const color = getNodeTopicColor(tagNode);

      expect(CONSTELLATION_PALETTE).toContain(color);
      // Strips # prefix cleanly
      const tagNodeNoHash = { type: 'tag' as const, name: 'systems' };
      expect(getNodeTopicColor(tagNodeNoHash)).toBe(color);
    });

    it('colors post nodes according to primary tag', () => {
      const postWithTags = {
        type: 'post' as const,
        name: 'Database Scaling',
        tags: ['databases', 'systems'],
        author: 'Alice',
      };
      const expectedTagColor = getNodeTopicColor({ type: 'tag', name: 'databases' });
      expect(getNodeTopicColor(postWithTags)).toBe(expectedTagColor);
    });

    it('falls back to author color if post has no tags', () => {
      const postTagless = {
        type: 'post' as const,
        name: 'Personal Thoughts',
        tags: [],
        author: 'Alice',
      };
      const expectedAuthorColor = getNodeTopicColor({ type: 'author', name: 'Alice' });
      expect(getNodeTopicColor(postTagless)).toBe(expectedAuthorColor);
    });

    it('uses architectural ink palette for tags in light mode', () => {
      const tagNode = { type: 'tag' as const, name: '#systems' };
      const lightColor = getNodeTopicColor(tagNode, false);
      expect(ARCHITECTURAL_INK_PALETTE).toContain(lightColor);
    });

    it('uses architectural author palette for authors in light mode', () => {
      const authorNode = { type: 'author' as const, name: 'Alice Walker' };
      const lightColor = getNodeTopicColor(authorNode, false);
      expect(ARCHITECTURAL_AUTHOR_PALETTE).toContain(lightColor);
    });
  });

  describe('getNodeReadingColor()', () => {
    it('returns completed green for completed posts', () => {
      expect(getNodeReadingColor({ type: 'post', readingStatus: 'completed' })).toBe(
        READING_COLORS.completed
      );
    });

    it('returns in-progress yellow for in-progress posts', () => {
      expect(getNodeReadingColor({ type: 'post', readingStatus: 'in-progress' })).toBe(
        READING_COLORS.inProgress
      );
    });

    it('returns dark or light slate for unread posts based on theme', () => {
      expect(getNodeReadingColor({ type: 'post', readingStatus: 'unread' }, true)).toBe(
        READING_COLORS.unreadDark
      );
      expect(getNodeReadingColor({ type: 'post', readingStatus: 'unread' }, false)).toBe(
        READING_COLORS.unreadLight
      );
    });

    it('returns neutral non-post slate for tags and authors', () => {
      expect(getNodeReadingColor({ type: 'tag' })).toBe(READING_COLORS.nonPost);
      expect(getNodeReadingColor({ type: 'author' })).toBe(READING_COLORS.nonPost);
    });
  });

  describe('getTagColors()', () => {
    it('returns valid dark and light hex strings and style property', () => {
      const colors = getTagColors('engineering');
      expect(colors.dark).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.light).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.style).toBe(
        `--tag-color-dark: ${colors.dark}; --tag-color-light: ${colors.light};`
      );
    });

    it('matches getNodeTopicColor output exactly for both themes', () => {
      const colors = getTagColors('databases');
      const expectedDark = hexToColorString(
        getNodeTopicColor({ type: 'tag', name: 'databases' }, true)
      );
      const expectedLight = hexToColorString(
        getNodeTopicColor({ type: 'tag', name: 'databases' }, false)
      );
      expect(colors.dark).toBe(expectedDark);
      expect(colors.light).toBe(expectedLight);
    });

    it('normalizes hash prefix and surrounding whitespace consistently', () => {
      const c1 = getTagColors('systems');
      const c2 = getTagColors('  #systems  ');
      expect(c1).toEqual(c2);
    });

    it('handles empty tag gracefully with fallback', () => {
      const colors = getTagColors('');
      expect(colors.dark).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.light).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

