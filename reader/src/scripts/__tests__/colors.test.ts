import { describe, it, expect } from 'vitest';
import {
  hashString,
  hexToColorString,
  colorStringToHex,
  getDeterministicColor,
  READING_COLORS,
  GRAPH_SCENE_COLORS,
  AEROSPACE_404_COLORS,
  CONSTELLATION_PALETTE,
  AUTHOR_PALETTE,
  ARCHITECTURAL_INK_PALETTE,
  ARCHITECTURAL_AUTHOR_PALETTE,
} from '../../utils/colors';

describe('centralized colors registry (colors.ts)', () => {
  describe('hashing and conversion utilities', () => {
    it('generates deterministic hashes', () => {
      expect(hashString('astro')).toBe(hashString('astro'));
      expect(hashString('astro')).not.toBe(hashString('spacex'));
    });

    it('converts numbers to hex strings and vice versa', () => {
      expect(hexToColorString(0x38bdf8)).toBe('#38bdf8');
      expect(colorStringToHex('#38bdf8')).toBe(0x38bdf8);
      expect(colorStringToHex('38bdf8')).toBe(0x38bdf8);
    });

    it('falls back to default palette color on invalid hex', () => {
      expect(colorStringToHex('invalid')).toBe(CONSTELLATION_PALETTE[0]);
    });

    it('maps keys deterministically to palettes', () => {
      const c1 = getDeterministicColor('systems', CONSTELLATION_PALETTE);
      const c2 = getDeterministicColor(' systems ', CONSTELLATION_PALETTE);
      expect(c1).toBe(c2);
      expect(CONSTELLATION_PALETTE).toContain(c1);
    });

    it('supports custom override map', () => {
      const customMap = { special: 0xff0000 };
      expect(getDeterministicColor('special', CONSTELLATION_PALETTE, customMap)).toBe(0xff0000);
    });
  });

  describe('READING_COLORS', () => {
    it('defines distinct stoplight hex colors', () => {
      expect(READING_COLORS.completed).toBe(0x22c55e);
      expect(READING_COLORS.inProgress).toBe(0xfacc15);
      expect(READING_COLORS.toReadDark).toBe(0xff453a);
      expect(READING_COLORS.toReadLight).toBe(0xe11d48);
      expect(READING_COLORS.unreadDark).toBe(0x475569);
      expect(READING_COLORS.unreadLight).toBe(0x94a3b8);
      expect(READING_COLORS.nonPost).toBe(0x64748b);
    });
  });

  describe('GRAPH_SCENE_COLORS', () => {
    it('defines valid 24-bit integer colors for links and lighting', () => {
      expect(typeof GRAPH_SCENE_COLORS.linksDark).toBe('number');
      expect(typeof GRAPH_SCENE_COLORS.linksLight).toBe('number');
      expect(typeof GRAPH_SCENE_COLORS.activeLinkDark).toBe('number');
      expect(typeof GRAPH_SCENE_COLORS.activeLinkLight).toBe('number');
      expect(typeof GRAPH_SCENE_COLORS.starMatDark).toBe('number');
      expect(typeof GRAPH_SCENE_COLORS.starMatLight).toBe('number');
    });
  });

  describe('AEROSPACE_404_COLORS', () => {
    it('defines valid colors for Starship, paper plane, and studio rig', () => {
      expect(typeof AEROSPACE_404_COLORS.chromeDark).toBe('number');
      expect(typeof AEROSPACE_404_COLORS.chromeLight).toBe('number');
      expect(typeof AEROSPACE_404_COLORS.engineBell).toBe('number');
      expect(typeof AEROSPACE_404_COLORS.plume).toBe('number');
      expect(typeof AEROSPACE_404_COLORS.corePlume).toBe('number');
      expect(typeof AEROSPACE_404_COLORS.creaseLines).toBe('number');
      expect(typeof AEROSPACE_404_COLORS.paperFront).toBe('number');
      expect(typeof AEROSPACE_404_COLORS.paperSide).toBe('number');
      expect(AEROSPACE_404_COLORS.paperBase).toBe('#f8f6f0');
      expect(AEROSPACE_404_COLORS.paperRuling).toContain('rgba');
      expect(AEROSPACE_404_COLORS.paperMargin).toContain('rgba');
      expect(AEROSPACE_404_COLORS.starfieldBlueDark).toBe('186, 230, 253');
    });
  });


  describe('palettes', () => {
    it('contains balanced palettes for dark and light modes', () => {
      expect(CONSTELLATION_PALETTE.length).toBe(16);
      expect(AUTHOR_PALETTE.length).toBe(10);
      expect(ARCHITECTURAL_INK_PALETTE.length).toBe(16);
      expect(ARCHITECTURAL_AUTHOR_PALETTE.length).toBe(10);
    });
  });
});
