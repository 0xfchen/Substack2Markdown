import { onReady } from './mount';
import {
  fetchReadingState,
  getReadingEntry,
  updateReadingProgress,
  READING_STATUS_CHANGE_EVENT,
  type ReadingStatusChangeEventDetail,
} from './reading-tracker';

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Present floating reading progress toast feedback in the bottom-left corner.
 */
export function showReadingToast(toast: HTMLElement, message: string, icon = ''): void {
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${message}</span>`;
  toast.classList.add('is-visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 4000);
}

/**
 * Update the 20-dash rail ticks.
 * - `is-active`: Illuminates all ticks up to `maxReadRatio` (high-water mark).
 * - `is-current`: Focal indicator highlighting the tick at the reader's current viewport position.
 */
export function updateRailTicks(
  ticks: HTMLButtonElement[],
  currentRatio: number,
  maxReadRatio: number = currentRatio
): void {
  const currentStep = currentRatio <= 0.01 ? 0 : Math.min(20, Math.max(1, Math.ceil(currentRatio * 20)));
  const maxStep = maxReadRatio <= 0.01 ? 0 : Math.min(20, Math.max(1, Math.ceil(maxReadRatio * 20)));
  ticks.forEach((tick, idx) => {
    const step = idx + 1; // 1 to 20
    const isPassed = step <= maxStep;
    const isCurrent = step === currentStep && currentRatio > 0.01;
    tick.classList.toggle('is-active', isPassed || (maxReadRatio >= 0.98 && step === 20));
    tick.classList.toggle('is-current', isCurrent);
  });
}

/**
 * Calculate reading progress ratio based on the article's prose bounding position.
 */
export function calculateReadingRatio(prose: HTMLElement): number {
  const proseRect = prose.getBoundingClientRect();
  const windowHeight = window.innerHeight;

  // Start when top of prose reaches 50% of viewport
  const startY = proseRect.top + window.scrollY - windowHeight * 0.5;
  // End when bottom of prose reaches 70% of viewport
  const endY = proseRect.top + window.scrollY + proseRect.height - windowHeight * 0.7;
  const scrollableDistance = endY - startY;

  if (scrollableDistance <= 0) {
    return window.scrollY >= startY ? 1 : 0;
  }

  // Check if reader reached the bottom of the document
  const isAtDocBottom = window.scrollY + windowHeight >= document.documentElement.scrollHeight - 25;
  if (isAtDocBottom) {
    return 1.0;
  }

  const currentDistance = window.scrollY - startY;
  const rawRatio = currentDistance / scrollableDistance;
  return Math.max(0, Math.min(1, rawRatio));
}

/**
 * Compute the target vertical scroll position corresponding to a given progress ratio.
 */
export function getScrollYForRatio(prose: HTMLElement, ratio: number): number {
  const proseRect = prose.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const startY = proseRect.top + window.scrollY - windowHeight * 0.5;
  const endY = proseRect.top + window.scrollY + proseRect.height - windowHeight * 0.7;
  const scrollableDistance = endY - startY;
  return Math.max(0, startY + ratio * scrollableDistance);
}

/**
 * Initialize scroll tracking, tick updates, click-to-scroll, and resume logic for the progress rail.
 */
export function initProgressRail(): void {
  const rail = document.querySelector<HTMLElement>('[data-progress-rail]');
  if (!rail) return;

  const slug = rail.dataset.slug;
  const ticks = [...rail.querySelectorAll<HTMLButtonElement>('[data-tick]')];
  const prose = document.querySelector<HTMLElement>('#prose-content');
  const toast = document.querySelector<HTMLElement>('[data-reading-toast]');

  if (!slug || !prose || ticks.length === 0) return;

  if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
    try {
      history.scrollRestoration = 'manual';
    } catch {
      // Ignore if restricted
    }
  }

  // Track high-water mark for reading progress
  let maxRatio = 0;
  const initialEntry = getReadingEntry(slug);
  if (initialEntry && typeof initialEntry.scrollRatio === 'number') {
    maxRatio = initialEntry.scrollRatio;
  }

  const toastFeedback = (message: string, icon = '') => {
    if (toast) showReadingToast(toast, message, icon);
  };

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!slug || !prose) return;
      const ratio = calculateReadingRatio(prose);
      if (ratio > maxRatio) {
        maxRatio = ratio;
      }
      updateRailTicks(ticks, ratio, maxRatio);

      const result = updateReadingProgress(slug, ratio);
      if (result.statusChanged) {
        if (result.status === 'in-progress') {
          toastFeedback('Reading', '◑');
        } else if (result.status === 'completed') {
          if (result.readCount > 1) {
            toastFeedback(`Completed (${result.readCount}×)`, '✓');
          } else {
            toastFeedback('Completed', '✓');
          }
        }
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // React to external reading status changes (reread reset or completion button)
  window.addEventListener(READING_STATUS_CHANGE_EVENT, ((e: CustomEvent<ReadingStatusChangeEventDetail>) => {
    if (e.detail?.slug !== slug) return;
    const { status, state } = e.detail;
    if (status === 'pending') {
      maxRatio = 0;
      updateRailTicks(ticks, 0, 0);
      const count = state.readCount || 0;
      if (count >= 1) {
        toastFeedback(`Ready for reread #${count + 1}`, '↺');
      }
    } else if (status === 'completed') {
      maxRatio = 1.0;
      updateRailTicks(ticks, 1.0, 1.0);
      const count = state.readCount || 1;
      if (count > 1) {
        toastFeedback(`Completed (${count}×)`, '✓');
      } else {
        toastFeedback('Completed', '✓');
      }
    } else if (typeof state.scrollRatio === 'number') {
      maxRatio = Math.max(maxRatio, state.scrollRatio);
      updateRailTicks(ticks, state.scrollRatio, maxRatio);
    }
  }) as EventListener);

  let hasRestoredPosition = false;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let userInterrupted = false;

  const onUserInteraction = (e: Event) => {
    if (e.type === 'keydown') {
      const key = (e as KeyboardEvent).key;
      if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(key)) {
        return;
      }
    }
    userInterrupted = true;
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    cleanupUserInteraction();
  };

  const cleanupUserInteraction = () => {
    window.removeEventListener('wheel', onUserInteraction);
    window.removeEventListener('touchmove', onUserInteraction);
    window.removeEventListener('keydown', onUserInteraction);
  };

  window.addEventListener('wheel', onUserInteraction, { passive: true });
  window.addEventListener('touchmove', onUserInteraction, { passive: true });
  window.addEventListener('keydown', onUserInteraction, { passive: true });

  // Click on a rail tick to smooth scroll to that percentage
  ticks.forEach((tick) => {
    tick.addEventListener('click', (e) => {
      e.preventDefault();
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
      cleanupUserInteraction();
      userInterrupted = true;
      const percent = Number(tick.dataset.tick || 0);
      if (!prose) return;

      const proseRect = prose.getBoundingClientRect();
      const absoluteProseTop = proseRect.top + window.scrollY;
      const targetScroll =
        absoluteProseTop + proseRect.height * (percent / 100) - window.innerHeight * 0.35;

      window.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    });
  });

  function restoreReadingPosition(isSmooth = true) {
    if (!slug || !prose || hasRestoredPosition || window.location.hash) return;
    const entry = getReadingEntry(slug);
    const savedRatio = entry?.scrollRatio;

    const isResumable =
      Boolean(entry) &&
      (entry!.status === 'in-progress' ||
        (typeof savedRatio === 'number' && savedRatio >= 0.08 && entry!.status !== 'completed')) &&
      typeof savedRatio === 'number' &&
      savedRatio >= 0.08;

    if (isResumable && typeof savedRatio === 'number') {
      hasRestoredPosition = true;
      maxRatio = Math.max(maxRatio, savedRatio);

      // Light up rail ticks immediately to provide instant visual feedback on rail
      updateRailTicks(ticks, savedRatio, maxRatio);

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const targetScroll = getScrollYForRatio(prose, savedRatio);
      const pct = Math.round(savedRatio * 100);

      if (prefersReducedMotion || !isSmooth) {
        cleanupUserInteraction();
        window.scrollTo({ top: targetScroll, behavior: 'instant' });
        toastFeedback(`Resumed at ${pct}%`, '📖');
      } else {
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => {
          resumeTimer = null;
          cleanupUserInteraction();
          if (userInterrupted) return;

          // Re-calculate target in case webfonts or layout settled
          const freshTarget = getScrollYForRatio(prose, savedRatio);
          window.scrollTo({ top: freshTarget, behavior: 'smooth' });
          toastFeedback(`Resumed at ${pct}%`, '📖');
        }, 120);
      }
    } else {
      onScroll();
    }
  }

  // Restore position from local cache immediately with smooth transition
  restoreReadingPosition(true);

  // Re-verify after server state is synced
  fetchReadingState().then(() => {
    const entry = getReadingEntry(slug);
    if (entry && typeof entry.scrollRatio === 'number') {
      maxRatio = Math.max(maxRatio, entry.scrollRatio);
    }
    if (!hasRestoredPosition && !userInterrupted) {
      restoreReadingPosition(true);
    } else {
      onScroll();
    }
  });
}

export function mountProgressRail(): void {
  onReady(initProgressRail);
}

