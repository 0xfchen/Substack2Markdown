import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showReadingToast,
  updateRailTicks,
  calculateReadingRatio,
  getScrollYForRatio,
} from '../progress-rail';

describe('progress-rail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('showReadingToast()', () => {
    it('sets innerHTML, adds is-visible, and removes it after 4 seconds', () => {
      const classSet = new Set<string>();
      const mockToast = {
        innerHTML: '',
        classList: {
          add: vi.fn((className: string) => classSet.add(className)),
          remove: vi.fn((className: string) => classSet.delete(className)),
          contains: vi.fn((className: string) => classSet.has(className)),
        },
      } as any;

      showReadingToast(mockToast, 'Progress saved: 45%', '✓');
      expect(mockToast.innerHTML).toContain('toast-icon');
      expect(mockToast.innerHTML).toContain('✓');
      expect(mockToast.innerHTML).toContain('Progress saved: 45%');
      expect(mockToast.classList.add).toHaveBeenCalledWith('is-visible');

      // Fast-forward 3.9s -> still visible
      vi.advanceTimersByTime(3900);
      expect(mockToast.classList.remove).not.toHaveBeenCalled();

      // Fast-forward past 4s -> removed
      vi.advanceTimersByTime(200);
      expect(mockToast.classList.remove).toHaveBeenCalledWith('is-visible');
    });

    it('clears previous timer when invoked consecutively', () => {
      const mockToast = {
        innerHTML: '',
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
      } as any;

      showReadingToast(mockToast, 'First message');
      vi.advanceTimersByTime(2000);
      showReadingToast(mockToast, 'Second message');
      vi.advanceTimersByTime(2500);

      // Total 4.5s since first call, but only 2.5s since second call
      expect(mockToast.classList.remove).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1600);
      expect(mockToast.classList.remove).toHaveBeenCalledWith('is-visible');
    });
  });

  describe('updateRailTicks()', () => {
    function createMockTicks(count = 20) {
      return Array.from({ length: count }, (_, idx) => {
        const classes = new Set<string>();
        return {
          idx,
          classList: {
            toggle: vi.fn((className: string, force?: boolean) => {
              if (force) classes.add(className);
              else classes.delete(className);
            }),
            contains: (className: string) => classes.has(className),
          },
        } as any;
      });
    }

    it('clears active and current classes when progress is near zero (<= 0.01)', () => {
      const ticks = createMockTicks(20);
      updateRailTicks(ticks, 0.005, 0.005);

      ticks.forEach((tick) => {
        expect(tick.classList.toggle).toHaveBeenCalledWith('is-active', false);
        expect(tick.classList.toggle).toHaveBeenCalledWith('is-current', false);
      });
    });

    it('activates ticks up to maxReadRatio step and highlights current position', () => {
      const ticks = createMockTicks(20);
      // current ratio = 0.25 (step 5 of 20), max ratio = 0.50 (step 10 of 20)
      updateRailTicks(ticks, 0.25, 0.5);

      // Ticks 1 to 10 should be active
      for (let i = 0; i < 10; i++) {
        expect(ticks[i].classList.toggle).toHaveBeenCalledWith('is-active', true);
      }
      // Ticks 11 to 20 should be inactive
      for (let i = 10; i < 20; i++) {
        expect(ticks[i].classList.toggle).toHaveBeenCalledWith('is-active', false);
      }

      // Only tick 5 (idx 4) should be current
      expect(ticks[4].classList.toggle).toHaveBeenCalledWith('is-current', true);
      expect(ticks[3].classList.toggle).toHaveBeenCalledWith('is-current', false);
      expect(ticks[5].classList.toggle).toHaveBeenCalledWith('is-current', false);
    });

    it('illuminates all 20 ticks when maxReadRatio >= 0.98', () => {
      const ticks = createMockTicks(20);
      updateRailTicks(ticks, 0.99, 0.99);

      for (let i = 0; i < 20; i++) {
        expect(ticks[i].classList.toggle).toHaveBeenCalledWith('is-active', true);
      }
      expect(ticks[19].classList.toggle).toHaveBeenCalledWith('is-current', true);
    });
  });

  describe('calculateReadingRatio()', () => {
    let originalWindow: any;
    let originalDocument: any;

    beforeEach(() => {
      originalWindow = (global as any).window;
      originalDocument = (global as any).document;

      (global as any).window = {
        innerHeight: 1000,
        scrollY: 0,
      };
      (global as any).document = {
        documentElement: {
          scrollHeight: 5000,
        },
      };
    });

    afterEach(() => {
      (global as any).window = originalWindow;
      (global as any).document = originalDocument;
    });

    it('returns 0 when viewport has not reached start of prose', () => {
      const mockProse = {
        getBoundingClientRect: () => ({ top: 1200, height: 3000 }),
      } as HTMLElement;

      (global as any).window.scrollY = 0;
      const ratio = calculateReadingRatio(mockProse);
      expect(ratio).toBe(0);
    });

    it('calculates proportional reading ratio as viewport traverses prose', () => {
      // documentTop = 500, proseHeight = 3000, windowHeight = 1000
      // startY = 500 - 500 = 0
      // endY = 500 + 3000 - 700 = 2800
      // scrollableDistance = 2800
      // at scrollY = 1400: ratio = 1400 / 2800 = 0.5
      const proseDocumentTopPosition = 500;
      const proseContentHeight = 3000;
      const mockProse = {
        getBoundingClientRect: () => ({
          top: proseDocumentTopPosition - (global as any).window.scrollY,
          height: proseContentHeight,
        }),
      } as HTMLElement;

      (global as any).window.scrollY = 1400; // halfway
      const readingRatio = calculateReadingRatio(mockProse);
      expect(readingRatio).toBeCloseTo(0.5, 2);
    });

    it('returns 1.0 when reader reaches bottom of document', () => {
      const mockProse = {
        getBoundingClientRect: () => ({ top: -1000, height: 2000 }),
      } as HTMLElement;

      (global as any).window.scrollY = 4000;
      (global as any).window.innerHeight = 1000;
      // scrollY + innerHeight = 5000 >= 5000 - 25
      const ratio = calculateReadingRatio(mockProse);
      expect(ratio).toBe(1.0);
    });

    it('returns 1 if scrollableDistance <= 0 and scrollY >= startY', () => {
      // Very short prose element
      const mockProse = {
        getBoundingClientRect: () => ({ top: 100, height: 50 }),
      } as HTMLElement;

      (global as any).window.scrollY = 200;
      const ratio = calculateReadingRatio(mockProse);
      expect(ratio).toBe(1);
    });
  });

  describe('getScrollYForRatio()', () => {
    let originalWindow: any;

    beforeEach(() => {
      originalWindow = (global as any).window;
      (global as any).window = {
        innerHeight: 1000,
        scrollY: 0,
      };
    });

    afterEach(() => {
      (global as any).window = originalWindow;
    });

    it('returns target vertical scroll position corresponding to ratio', () => {
      const mockProse = {
        getBoundingClientRect: () => ({ top: 500, height: 3000 }),
      } as HTMLElement;

      // startY = 500 - 500 = 0
      // endY = 500 + 3000 - 700 = 2800
      // target scroll for 50% = 0 + 2800 * 0.5 = 1400
      const targetScroll = getScrollYForRatio(mockProse, 0.5);
      expect(targetScroll).toBe(1400);

      // target scroll for 100% = 2800
      expect(getScrollYForRatio(mockProse, 1.0)).toBe(2800);
    });
  });
});
